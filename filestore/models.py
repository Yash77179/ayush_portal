from django.db import models


class StoredFile(models.Model):
    """An uploaded file kept in the database — used in production, where the server's own disk is wiped on every deploy."""

    name = models.CharField(max_length=255, unique=True)  # the path Django gives it, e.g. "resumes/resume-12.pdf"
    content = models.BinaryField()
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
