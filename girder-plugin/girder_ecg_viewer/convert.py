"""On-the-fly conversion of vendor ECG files to DICOM with ecg-bridge.

The ecg-bridge ``*-to-dicom`` CLIs (https://github.com/LIRYC-IHU/ecg-bridge)
are looked up in ``$ECG_BRIDGE_PATH`` (a PATH-style list of directories) and
then on ``$PATH``. A format whose converter is missing is simply not offered.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile

from girder.models.file import File

from .formats import FORMATS

#: Seconds a single conversion may take.
CONVERSION_TIMEOUT = 60


class ConversionError(Exception):
    pass


def converterPath(formatKey):
    """Absolute path of the converter for a format, or None if unavailable."""
    name = FORMATS[formatKey].converter
    if name is None:
        return None
    extra = os.environ.get('ECG_BRIDGE_PATH')
    return (extra and shutil.which(name, path=extra)) or shutil.which(name)


def isSupported(formatKey):
    return formatKey == 'dicom' or converterPath(formatKey) is not None


def toDicom(formatKey, file):
    """Convert a Girder file of the given format; return the DICOM bytes."""
    fmt = FORMATS[formatKey]
    exe = converterPath(formatKey)
    if exe is None:
        raise ConversionError(f'No converter installed for {fmt.label} files.')

    with tempfile.TemporaryDirectory(prefix='girder-ecg-viewer-') as tmp:
        # The XML converters insist on a .xml input and a .dcm output.
        src = pathlib.Path(tmp) / f'input{fmt.inputExtension}'
        out = pathlib.Path(tmp) / 'output.dcm'
        with src.open('wb') as fh:
            for chunk in File().download(file, headers=False)():
                fh.write(chunk)

        try:
            # stdin is /dev/null: the CLIs read metadata overrides from a piped
            # stdin, and a character device means "nothing to inject".
            proc = subprocess.run(
                [exe, '--input', str(src), '--output', str(out)],
                stdin=subprocess.DEVNULL, capture_output=True,
                timeout=CONVERSION_TIMEOUT, check=False)
        except subprocess.TimeoutExpired:
            raise ConversionError(f'{fmt.label} conversion timed out.') from None

        if proc.returncode != 0 or not out.is_file():
            raise ConversionError(
                f'{fmt.label} conversion failed: {_errorDetail(proc)}')
        return out.read_bytes()


def _errorDetail(proc):
    """The CLI's own error message, without the usage text cobra prints after it."""
    lines = proc.stderr.decode('utf-8', errors='replace').splitlines()
    for line in lines:
        if line.startswith('Error: '):
            return line[len('Error: '):].strip()
    lines = [line for line in lines if line.strip()]
    return lines[-1].strip() if lines else f'exit status {proc.returncode}'
