"""A Django storage backend that keeps uploads in the database.

Turned on with FILE_STORAGE=database (see settings). Hosts like Render's free plan have no persistent disk,
so files saved to the filesystem would disappear on every redeploy; the database survives.
"""

import mimetypes

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible


@deconstructible
class DatabaseStorage(Storage):
    def _model(self):
        from .models import StoredFile  # imported lazily: storages are created before apps are ready

        return StoredFile

    def _open(self, name, mode="rb"):
        try:
            f = self._model().objects.get(name=name)
        except self._model().DoesNotExist:
            raise FileNotFoundError(name) from None
        return ContentFile(bytes(f.content), name=name)

    def _save(self, name, content):
        if hasattr(content, "seek"):
            content.seek(0)
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        content_type = getattr(content, "content_type", None) or mimetypes.guess_type(name)[0] or "application/octet-stream"
        self._model().objects.update_or_create(
            name=name, defaults={"content": data, "size": len(data), "content_type": content_type}
        )
        return name

    def exists(self, name):
        return self._model().objects.filter(name=name).exists()

    def delete(self, name):
        self._model().objects.filter(name=name).delete()

    def size(self, name):
        f = self._model().objects.filter(name=name).only("size").first()
        if f is None:
            raise FileNotFoundError(name)
        return f.size

    def url(self, name):
        return f"{settings.MEDIA_URL}{name}"


@deconstructible
class CloudinaryStorage(Storage):
    """Keeps uploads on Cloudinary. Turned on with FILE_STORAGE=cloudinary; reads the CLOUDINARY_URL env var.

    Everything is stored as a "raw" file so PDFs, images and anything else keep their exact bytes and extension,
    and each file gets a permanent public HTTPS link that the frontend can open directly.
    """

    RESOURCE = "raw"

    def _cloudinary(self):
        import cloudinary
        import cloudinary.api
        import cloudinary.exceptions
        import cloudinary.uploader
        import cloudinary.utils

        return cloudinary

    def _save(self, name, content):
        cl = self._cloudinary()
        if hasattr(content, "seek"):
            content.seek(0)
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        cl.uploader.upload(data, public_id=name, resource_type=self.RESOURCE, overwrite=True, invalidate=True)
        return name

    def get_available_name(self, name, max_length=None):
        # Don't ask Cloudinary whether a name is taken (each check is a rate-limited Admin API call):
        # give every upload a short random suffix instead, so names never collide.
        import os
        import uuid

        root, ext = os.path.splitext(name)
        name = f"{root}-{uuid.uuid4().hex[:8]}{ext}"
        return name[:max_length] if max_length and len(name) > max_length else name

    def exists(self, name):
        cl = self._cloudinary()
        try:
            cl.api.resource(name, resource_type=self.RESOURCE)
            return True
        except cl.exceptions.NotFound:
            return False

    def _open(self, name, mode="rb"):
        import urllib.error
        import urllib.request

        try:
            with urllib.request.urlopen(self.url(name), timeout=20) as res:
                return ContentFile(res.read(), name=name)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise FileNotFoundError(name) from None
            raise

    def delete(self, name):
        self._cloudinary().uploader.destroy(name, resource_type=self.RESOURCE, invalidate=True)

    def size(self, name):
        cl = self._cloudinary()
        try:
            return cl.api.resource(name, resource_type=self.RESOURCE)["bytes"]
        except cl.exceptions.NotFound:
            raise FileNotFoundError(name) from None

    def url(self, name):
        return self._cloudinary().utils.cloudinary_url(name, resource_type=self.RESOURCE, secure=True)[0]
