pkill -f "uvicorn server:app --port 4000"
git pull
cd Client
npm install
npm run build
cd ~/totally_spy/Totally-Spy/Server/ && source ~/totally_spy/Totally-Spy/.venv/bin/activate && nohup uvicorn server:app --port 4000 --host 0.0.0.0 &