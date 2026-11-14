# Rent A Robot

A basic Flask website for a U.S. robot-rental service supporting commercial cleaning companies, storefronts and businesses, and residential customers.

## Visual Studio Professional

1. Install the **Python development** workload in Visual Studio.
2. Open `RentARobot.sln`.
3. Create or select a Python environment for the project.
4. Install dependencies from `requirements.txt` (right-click **Python Environments**, then install from requirements).
5. Press **F5** to debug. The startup file is `app.py`, and the site runs at `http://127.0.0.1:4900`.

Set breakpoints in `app.py` as usual. Flask debug mode is enabled for local development.

## Command line

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Then open <http://127.0.0.1:4900>.

## Project structure

- `app.py` — Flask routes and the demo quote API
- `templates/index.html` — editable page content
- `static/site.css` — layout, colors, and responsive styling
- `static/site.js` — ZIP lookup and quote-form interactions
- `RentARobot.sln` / `RentARobot.pyproj` — Visual Studio solution and Python project

The quote endpoint currently validates and acknowledges submissions but does not persist or email them. Connect `/api/quote` to a database, CRM, or email provider before production use.
