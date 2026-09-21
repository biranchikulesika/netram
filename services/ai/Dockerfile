FROM python:3.12-slim

WORKDIR /app

COPY services/ai/pyproject.toml services/ai/
COPY services/ai/app services/ai/app

RUN pip install --no-cache-dir -e "services/ai"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--app-dir", "services/ai", "--host", "0.0.0.0", "--port", "8000"]
