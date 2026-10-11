"""On-the-fly conversion of ECG files with ecg-bridge.

The ecg-bridge ``*-to-dicom`` and ``*-to-fda`` CLIs
(https://github.com/LIRYC-IHU/ecg-bridge) are looked up in
``$ECG_BRIDGE_PATH`` (a PATH-style list of directories) and then on ``$PATH``.
A conversion whose CLI is missing is simply not offered.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile

from girder.models.file import File

from .formats import FORMATS, TARGETS

#: Seconds a single conversion may take.
CONVERSION_TIMEOUT = 60


class ConversionError(Exception):
    pass


def converterPath(source, target):
    """Absolute path of the CLI converting ``source`` to ``target``, or None."""
    name = FORMATS[source].converters.get(target)
    if name is None:
        return None
    extra = os.environ.get('ECG_BRIDGE_PATH')
    return (extra and shutil.which(name, path=extra)) or shutil.which(name)


def canConvert(source, target):
    """Whether a file of format ``source`` can be served as ``target``."""
    return source == target or converterPath(source, target) is not None


def isSupported(formatKey):
    """Whether files of this format can be shown in the viewer (as DICOM)."""
    return canConvert(formatKey, 'dicom')


def exportTargets(formatKey):
    """Keys of the formats a file of this format can be downloaded as."""
    return [target for target in TARGETS if canConvert(formatKey, target)]


def convert(source, target, file):
    """Convert a Girder file from ``source`` to ``target`` format; return the bytes."""
    fmt = FORMATS[source]
    exe = converterPath(source, target)
    if exe is None:
        raise ConversionError(
            f'No converter installed from {fmt.label} to {TARGETS[target].label}.')

    with tempfile.TemporaryDirectory(prefix='girder-ecg-viewer-') as tmp:
        # Several CLIs check extensions: .xml / .dcm inputs, .dcm / .xml outputs.
        src = pathlib.Path(tmp) / f'input{fmt.inputExtension}'
        out = pathlib.Path(tmp) / f'output{TARGETS[target].extension}'
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
            raise ConversionError(
                f'{fmt.label} to {TARGETS[target].label} conversion timed out.') from None

        if proc.returncode != 0 or not out.is_file():
            raise ConversionError(
                f'{fmt.label} to {TARGETS[target].label} conversion failed: '
                f'{_errorDetail(proc)}')
        return out.read_bytes()


def _errorDetail(proc):
    """The CLI's own error message, without the usage text cobra prints after it."""
    lines = proc.stderr.decode('utf-8', errors='replace').splitlines()
    for line in lines:
        if line.startswith('Error: '):
            return line[len('Error: '):].strip()
    lines = [line for line in lines if line.strip()]
    return lines[-1].strip() if lines else f'exit status {proc.returncode}'
