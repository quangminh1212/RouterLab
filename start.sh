docker stop xlabrouter
docker rm xlabrouter
docker build -t xlabrouter .
docker run -d --name xlabrouter -p 1212:1212 --env-file .env -v xlabrouter-data:/app/data xlabrouter