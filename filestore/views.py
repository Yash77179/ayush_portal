import mimetypes

from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404


def serve_media(request, path):
    """Serve an uploaded file from whichever storage is active (disk locally, database in production)."""
    try:
        f = default_storage.open(path)
    except (FileNotFoundError, SuspiciousFileOperation, ValueError):
        raise Http404("File not found.") from None
    response = FileResponse(f, content_type=mimetypes.guess_type(path)[0] or "application/octet-stream")
    response["Cache-Control"] = "public, max-age=86400"
    return response
