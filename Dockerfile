# CareerBridge API (Django) for Fly.io. Fly builds this remotely — no local Docker needed.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Static files are baked into the image (served by WhiteNoise). The key here is only for this build step.
RUN SECRET_KEY=collectstatic-only DEBUG=False python manage.py collectstatic --noinput

EXPOSE 8000

# gthread workers + a long timeout so the AI assistant's streamed answers aren't cut off.
CMD ["gunicorn", "ayush_portal.wsgi", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4", "--worker-class", "gthread", "--timeout", "120", "--access-logfile", "-"]
