import requests
import os
import re
from datetime import datetime, timedelta

# -----------------------------------------------------------------------------
# Date range to pull agendas (in code — change these as needed).
# Events with EventDate on or between these dates (inclusive) will be included.
# Format: "YYYY-MM-DD"
# -----------------------------------------------------------------------------
DATE_RANGE_START = "2025-01-01"
DATE_RANGE_END = "2025-12-31"

# Legistar API base (client name is appended in code)
LEGISTAR_API_BASE = "https://webapi.legistar.com/v1"

# California cities and counties that use Legistar (display name -> API client id).
# Client id = subdomain from https://{client}.legistar.com (some use hyphens).
# To add more: find the jurisdiction's Legistar calendar URL; the part before
# ".legistar.com" is the client id.
LEGISTAR_CLIENTS = {
    "City of Sacramento": "sacramento",
    "Sacramento County (Board of Supervisors)": "saccounty",
    "City of San Francisco": "sfgov",
    "City of Oakland": "oakland",
    "City of San Jose": "san-jose",
    "City of Los Angeles": "lacity",
    "City of San Diego": "sandiego",
    "Los Angeles County (Board of Supervisors)": "lacounty",
    "San Diego County (Board of Supervisors)": "sandiegocounty",
    "Orange County (Board of Supervisors)": "ocgov",
    "Riverside County (Board of Supervisors)": "rivco",
    "San Bernardino County (Board of Supervisors)": "sbcounty",
    "Santa Clara County (Board of Supervisors)": "sccgov",
    "Alameda County (Board of Supervisors)": "acgov",
    "Contra Costa County": "contracosta",
    "Sonoma County (Board of Supervisors)": "sonoma-county",
    "Fresno County (Board of Supervisors)": "fresnocounty",
    "City of Fresno": "fresno",
    "City of Long Beach": "longbeach",
    "City of Bakersfield": "bakersfieldcity",
    "City of Anaheim": "anaheim",
    "City of Santa Ana": "santa-ana",
    "City of Riverside": "riversideca",
    "City of Stockton": "stockton",
}

# Request JSON; some Legistar endpoints return XML by default
HEADERS = {"Accept": "application/json"}

REQUEST_TIMEOUT = 30


def get_base_url(client_id):
    """Return Legistar API base URL for a client."""
    return f"{LEGISTAR_API_BASE}/{client_id}"


def get_events_with_agendas(base_url, start_date=None, end_date=None, top=500):
    """Fetch events in the given date range that have an agenda file."""
    url = f"{base_url}/Events"
    params = {
        "$top": top,
        "$orderby": "EventDate desc",
    }
    if start_date and end_date:
        # OData: EventDate >= start and EventDate < day_after_end (inclusive range)
        start_dt = start_date if isinstance(start_date, str) else start_date.strftime("%Y-%m-%d")
        end_dt = end_date if isinstance(end_date, str) else end_date.strftime("%Y-%m-%d")
        end_parsed = datetime.strptime(end_dt, "%Y-%m-%d")
        end_next = (end_parsed + timedelta(days=1)).strftime("%Y-%m-%d")
        params["$filter"] = (
            f"EventDate ge datetime'{start_dt}' and EventDate lt datetime'{end_next}'"
        )
    response = requests.get(url, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    events = response.json()
    return [e for e in events if e.get("EventAgendaFile")]


def safe_filename(name):
    """Remove characters that are invalid in filenames."""
    return re.sub(r'[<>:"/\\|?*]', "", name).strip() or "Agenda"


def download_file(url, filename):
    response = requests.get(url, stream=True, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    with open(filename, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)


def choose_client():
    """Let user pick a Legistar client from the list or enter a custom client id."""
    names = list(LEGISTAR_CLIENTS.keys())
    print("California Legistar jurisdictions (City Council / Board of Supervisors):")
    for i, name in enumerate(names, 1):
        print(f"  {i:2}. {name}")
    print(f"  {len(names) + 1:2}. Enter a custom client ID (e.g. your city/county subdomain from *.legistar.com)")
    while True:
        try:
            choice = input("\nEnter number (or custom client ID): ").strip()
            if not choice:
                continue
            # Allow typing a custom client id directly
            if choice.isdigit():
                n = int(choice)
                if 1 <= n <= len(names):
                    return LEGISTAR_CLIENTS[names[n - 1]], names[n - 1]
                if n == len(names) + 1:
                    custom = input("Custom client ID: ").strip()
                    if custom:
                        return custom, custom
            else:
                # Treat as custom client id
                return choice, choice
        except (ValueError, KeyError):
            pass
        print("Invalid choice. Try again.")


def main():
    client_id, display_name = choose_client()
    base_url = get_base_url(client_id)
    print(f"\nUsing: {display_name} ({base_url})")
    print(f"Date range: {DATE_RANGE_START} to {DATE_RANGE_END}")

    events = get_events_with_agendas(
        base_url,
        start_date=DATE_RANGE_START,
        end_date=DATE_RANGE_END,
    )

    if not events:
        print("No meetings with agenda files found in this date range.")
        return

    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Optional: save under a subfolder per client to avoid name clashes
    client_dir = os.path.join(script_dir, safe_filename(client_id))
    os.makedirs(client_dir, exist_ok=True)

    for event in events:
        agenda_url = event.get("EventAgendaFile")
        if not agenda_url:
            continue
        date_str = event["EventDate"][:10]
        body_name = safe_filename(event["EventBodyName"].replace(" ", "_"))
        filename = f"{date_str}_{body_name}_Agenda.pdf"
        file_path = os.path.join(client_dir, filename)
        print(f"Downloading: {filename}")
        try:
            download_file(agenda_url, file_path)
        except Exception as e:
            print(f"  Failed: {e}")

    print(f"\nDone. Saved {len(events)} agenda(s) to {client_dir}.")


if __name__ == "__main__":
    main()