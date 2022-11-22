run-debug:
	flask --debug run
run-demo:
	gunicorn3 -e SCRIPT_NAME=/hackaday/battle --bind 0.0.0.0:8021 app:app
