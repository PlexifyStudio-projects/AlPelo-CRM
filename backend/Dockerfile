FROM python:3.11

RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["bash", "/app/entrypoint.sh"]
