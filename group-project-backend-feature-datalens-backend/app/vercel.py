"""Vercel Python 서비스가 가져갈 ASGI 진입점."""

from app.main import create_app

app = create_app()
