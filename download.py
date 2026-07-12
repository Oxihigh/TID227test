import os
import time
import glob
import logging
from datetime import datetime
from playwright.sync_api import sync_playwright

def setup_logging():
    # Delete previous log files
    for log_file in glob.glob("*.log"):
        try:
            os.remove(log_file)
        except Exception:
            pass
            
    # Setup new log file with timestamp
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    log_filename = f"run_{timestamp}.log"
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )
    return log_filename

TARGET_PAGES = {
    "district_performance": "https://dashboards.toastmasters.org/District.aspx?id=121",
    "division_area_performance": "https://dashboards.toastmasters.org/Division.aspx?id=121",
    "club_performance": "https://dashboards.toastmasters.org/Club.aspx?id=121"
}

def download_csv_from_url(page, name, url, timestamp):
    logging.info(f"Navigating to {name}...")
    page.goto(url, timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(2)  # Allow legacy scripts to fully settle
    
    # 1. Catch the asynchronous file download event
    logging.info(f"Triggering CSV download...")
    with page.expect_download() as download_info:
        # Instead of clicking text, we change the value of the dropdown directly.
        # Selecting 'CSV' on this specific form automatically submits the postback.
        page.select_option("select[name*='Export']", value="CSV")
        
    download = download_info.value
    
    # Ensure data directory exists
    data_dir = os.path.join(os.getcwd(), "data")
    os.makedirs(data_dir, exist_ok=True)
    
    # Append the shared timestamp to the filename
    save_path = os.path.join(data_dir, f"{name}_{timestamp}.csv")
    
    download.save_as(save_path)
    logging.info(f"Download completed: {save_path}")
    return save_path

def merge_csvs(data_dir, timestamp):
    import pandas as pd
    club_file = os.path.join(data_dir, f"club_performance_{timestamp}.csv")
    district_file = os.path.join(data_dir, f"district_performance_{timestamp}.csv")
    div_file = os.path.join(data_dir, f"division_area_performance_{timestamp}.csv")
    
    if not (os.path.exists(club_file) and os.path.exists(district_file) and os.path.exists(div_file)):
        logging.error("Cannot merge: Not all CSV files were downloaded.")
        return
        
    try:
        # Load the CSVs, dropping any footer rows that lack a Club Name
        df_club = pd.read_csv(club_file).dropna(subset=['Club Name'])
        df_dist = pd.read_csv(district_file).dropna(subset=['Club Name'])
        df_div = pd.read_csv(div_file).dropna(subset=['Club Name'])
        
        # Standardize the 'Club' column name to 'Club Number' across all dataframes
        df_dist = df_dist.rename(columns={'Club': 'Club Number'})
        df_div = df_div.rename(columns={'Club': 'Club Number'})
        
        keys = ['District', 'Division', 'Area', 'Club Number', 'Club Name']
        
        merged = df_club.merge(df_dist, on=keys, how='outer', suffixes=('', '_dist'))
        merged = merged.merge(df_div, on=keys, how='outer', suffixes=('', '_div'))
        
        master_file = os.path.join(data_dir, f"master_performance_{timestamp}.csv")
        merged.to_csv(master_file, index=False)
        logging.info(f"Merged master file created: {master_file}")
        
        # Delete original 3 CSVs
        os.remove(club_file)
        os.remove(district_file)
        os.remove(div_file)
        logging.info("Deleted individual CSV files to save space.")
    except Exception as e:
        logging.error(f"Failed to merge CSVs: {e}")

def run_toastmasters_pipeline():
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    with sync_playwright() as p:
        # Running headless=True; change to False if you ever want to watch the window
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        for target_name, target_url in TARGET_PAGES.items():
            try:
                download_csv_from_url(page, target_name, target_url, timestamp)
            except Exception as e:
                logging.error(f"Failed processing {target_name}: {str(e)}")
                
        browser.close()
        
    data_dir = os.path.join(os.getcwd(), "data")
    merge_csvs(data_dir, timestamp)
    logging.info("Automation pipeline execution complete!")

if __name__ == "__main__":
    setup_logging()
    run_toastmasters_pipeline()
