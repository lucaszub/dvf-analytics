FROM python:3.11-slim

WORKDIR /transform

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["dbt", "run", "--profiles-dir", ".", "--project-dir", ".", "--no-use-colors"]
