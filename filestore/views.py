import mimetypes

from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, HttpResponseRedirect


def serve_media(request, path):
    """Serve an uploaded file from whichever storage is active (disk locally, Cloudinary or the database in production)."""
    if ".." in path.split("/"):
        raise Http404("File not found.")
    url = default_storage.url(path)
    if url.startswith(("http://", "https://")):  # files with their own public link (Cloudinary): send the browser there
        return HttpResponseRedirect(url)
    try:
        f = default_storage.open(path)
    except (FileNotFoundError, SuspiciousFileOperation, ValueError):
        raise Http404("File not found.") from None
    response = FileResponse(f, content_type=mimetypes.guess_type(path)[0] or "application/octet-stream")
    response["Cache-Control"] = "public, max-age=86400"
    return response
