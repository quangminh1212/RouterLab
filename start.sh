docker stop xlabrouter
docker rm xlabrouter
docker build -t xlabrouter .
docker run -d --name xlabrouter -p 20128:20128 --env-file .env -v xlabrouter-data:/app/data xlabrouter