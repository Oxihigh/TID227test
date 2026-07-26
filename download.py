import os
import time
import glob
import logging
from datetime import datetime
import pandas as pd
from playwright.sync_api import sync_playwright

def setup_logging():
    for log_file in glob.glob("*.log"):
        try:
            os.remove(log_file)
        except Exception:
            pass
            
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
    time.sleep(2)
    
<<<<<<< HEAD
    # 1. Catch the asynchronous file download event
    logging.info(f"Triggering CSV download...")
=======
    logging.info(f"📥 Triggering CSV download for {name}...")
>>>>>>> 1699800 (Update download pipeline and generate CSV, JSON, and Excel master outputs)
    with page.expect_download() as download_info:
        page.select_option("select[name*='Export']", value="CSV")
        
    download = download_info.value
    data_dir = os.path.join(os.getcwd(), "data")
    os.makedirs(data_dir, exist_ok=True)
    
    save_path = os.path.join(data_dir, f"{name}_{timestamp}.csv")
    download.save_as(save_path)
<<<<<<< HEAD
    logging.info(f"Download completed: {save_path}")
=======
    logging.info(f"✅ CSV download completed: {save_path}")
>>>>>>> 1699800 (Update download pipeline and generate CSV, JSON, and Excel master outputs)
    return save_path

def compute_master_metrics(final_df):
    df = final_df.copy()
    
<<<<<<< HEAD
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
=======
    # Distinguished Status
    def calc_distinguished(row):
        if row['Goals Met'] < 5:
            return "-"
        if row['Active Membership'] > 19 or row['Active Membership'] > row['Base Membership'] + 2:
            return "Yes"
        return "-"
    
    df['Distinguished Status'] = df.apply(calc_distinguished, axis=1)

    # September Renewals % & Status
    df['September Renewals %'] = df.apply(
        lambda r: round((r['September Renewals'] / r['Base Membership']), 4) if r['Base Membership'] > 0 else 0.0, axis=1
    )
    
    def calc_sept_status(row):
        sept = row['September Renewals']
        base = row['Base Membership']
        if sept == 0:
            return "Renewals not here"
        elif sept < 3:
            return "Ineligible"
        elif base < 8:
            return "Low"
        else:
            return "Active"
            
    df['September Renewal Status'] = df.apply(calc_sept_status, axis=1)

    # March Renewals % & Status
    df['March Renewals %'] = df.apply(
        lambda r: round((r['March Renewals'] / r['Base Membership']), 4) if r['Base Membership'] > 0 else 0.0, axis=1
    )
    
    def calc_march_status(row):
        march = row['March Renewals']
        active = row['Active Membership']
        if march == 0:
            return "Renewals not here"
        elif march < 3:
            return "Ineligible"
        elif active < 8:
            return "Low"
        else:
            return "Active"
            
    df['March Renewal Status'] = df.apply(calc_march_status, axis=1)

    df['Total New Members'] = df['New Member Payments']

    # Monthly breakdown columns
    months = ['July', 'August', 'September', 'October', 'November', 'December', 
              'January', 'February', 'March', 'April', 'May', 'June']
    for m in months:
        if m not in df.columns:
            df[m] = 0

    # Awards Campaigns
    df['Smedley Award Eligibility'] = (df['July'] + df['August'] + df['September']).apply(lambda x: 'Yes' if x >= 5 else 'No')
    df['Smedley Award Goal'] = (df['July'] + df['August'] + df['September']).apply(lambda x: 0 if x >= 5 else 5 - x)

    df['Talk Up Eligibility'] = (df['February'] + df['March']).apply(lambda x: 'Yes' if x >= 5 else 'No')
    df['Talk Up Goal'] = (df['February'] + df['March']).apply(lambda x: 0 if x >= 5 else 5 - x)

    df['Beat the Clock Eligibility'] = (df['May'] + df['June']).apply(lambda x: 'Yes' if x >= 5 else 'No')
    df['Beat the Clock Goal'] = (df['May'] + df['June']).apply(lambda x: 0 if x >= 5 else 5 - x)

    ordered_cols = [
        'Club Number', 'District', 'Division', 'Area', 'Club Name', 'Club Status',
        'Base Membership', 'Active Membership', 'Goals Met', 'Distinguished Status',
        'Total New Members', 'September Renewals', 'September Renewals %', 'September Renewal Status',
        'March Renewals', 'March Renewals %', 'March Renewal Status', 'Total Payments',
        'July', 'August', 'September', 'October', 'November', 'December',
        'January', 'February', 'March', 'April', 'May', 'June',
        'Smedley Award Eligibility', 'Smedley Award Goal',
        'Talk Up Eligibility', 'Talk Up Goal',
        'Beat the Clock Eligibility', 'Beat the Clock Goal'
    ]
    return df[ordered_cols]

def build_division_summary(master_df):
    divisions = sorted(master_df['Division'].dropna().unique().tolist())
    summary_rows = []
    
    for div in divisions:
        div_df = master_df[master_df['Division'] == div]
        base_clubs = len(div_df)
        active_clubs = len(div_df[div_df['Club Status'] == 'Active'])
        dist_clubs = len(div_df[div_df['Distinguished Status'] == 'Yes'])
        base_mem = div_df['Base Membership'].sum()
        act_mem = div_df['Active Membership'].sum()
        sept_ren = div_df['September Renewals'].sum()
        sept_ren_pct = round(sept_ren / base_mem, 4) if base_mem > 0 else 0.0
        march_ren = div_df['March Renewals'].sum()
        march_ren_pct = round(march_ren / base_mem, 4) if base_mem > 0 else 0.0
        new_mem = div_df['Total New Members'].sum()
        tot_pay = div_df['Total Payments'].sum()
        clubs_20plus = len(div_df[div_df['Active Membership'] >= 20])
        
        summary_rows.append({
            'Division': f"Division {div}",
            'Base Clubs': base_clubs,
            'Active Clubs': active_clubs,
            'Distinguished Clubs': dist_clubs,
            'Base Membership': base_mem,
            'Active Membership': act_mem,
            'September Renewals': sept_ren,
            'September Renewals %': sept_ren_pct,
            'March Renewals': march_ren,
            'March Renewals %': march_ren_pct,
            'Total New Members': new_mem,
            'Total Payments': tot_pay,
            '20+ Clubs': clubs_20plus
        })
        
    div_summary_df = pd.DataFrame(summary_rows)
    
    tot_base_mem = div_summary_df['Base Membership'].sum()
    total_row = {
        'Division': 'District Total',
        'Base Clubs': div_summary_df['Base Clubs'].sum(),
        'Active Clubs': div_summary_df['Active Clubs'].sum(),
        'Distinguished Clubs': div_summary_df['Distinguished Clubs'].sum(),
        'Base Membership': tot_base_mem,
        'Active Membership': div_summary_df['Active Membership'].sum(),
        'September Renewals': div_summary_df['September Renewals'].sum(),
        'September Renewals %': round(div_summary_df['September Renewals'].sum() / tot_base_mem, 4) if tot_base_mem > 0 else 0.0,
        'March Renewals': div_summary_df['March Renewals'].sum(),
        'March Renewals %': round(div_summary_df['March Renewals'].sum() / tot_base_mem, 4) if tot_base_mem > 0 else 0.0,
        'Total New Members': div_summary_df['Total New Members'].sum(),
        'Total Payments': div_summary_df['Total Payments'].sum(),
        '20+ Clubs': div_summary_df['20+ Clubs'].sum()
    }
    
    div_summary_df = pd.concat([div_summary_df, pd.DataFrame([total_row])], ignore_index=True)
    return div_summary_df

def build_area_summary(master_df):
    area_grp = master_df.groupby(['Division', 'Area'])
    summary_rows = []
    
    for (div, area), div_df in area_grp:
        base_mem = div_df['Base Membership'].sum()
        act_mem = div_df['Active Membership'].sum()
        sept_ren = div_df['September Renewals'].sum()
        sept_ren_pct = round(sept_ren / base_mem, 4) if base_mem > 0 else 0.0
        march_ren = div_df['March Renewals'].sum()
        march_ren_pct = round(march_ren / base_mem, 4) if base_mem > 0 else 0.0
        new_mem = div_df['Total New Members'].sum()
        tot_pay = div_df['Total Payments'].sum()
        
        summary_rows.append({
            'Division': div,
            'Area': area,
            'Base Membership': base_mem,
            'Active Membership': act_mem,
            'September Renewals': sept_ren,
            'September Renewals %': sept_ren_pct,
            'March Renewals': march_ren,
            'March Renewals %': march_ren_pct,
            'Total New Members': new_mem,
            'Total Payments': tot_pay
        })
        
    area_summary_df = pd.DataFrame(summary_rows)
    
    tot_base_mem = area_summary_df['Base Membership'].sum()
    tot_sept = area_summary_df['September Renewals'].sum()
    tot_march = area_summary_df['March Renewals'].sum()
    total_row = {
        'Division': 'Area Total',
        'Area': '',
        'Base Membership': tot_base_mem,
        'Active Membership': area_summary_df['Active Membership'].sum(),
        'September Renewals': tot_sept,
        'September Renewals %': round(tot_sept / tot_base_mem, 4) if tot_base_mem > 0 else 0.0,
        'March Renewals': tot_march,
        'March Renewals %': round(tot_march / tot_base_mem, 4) if tot_base_mem > 0 else 0.0,
        'Total New Members': area_summary_df['Total New Members'].sum(),
        'Total Payments': area_summary_df['Total Payments'].sum()
    }
    
    area_summary_df = pd.concat([area_summary_df, pd.DataFrame([total_row])], ignore_index=True)
    return area_summary_df

def build_dashboard_goals(master_df, div_summary_df):
    tot_row = div_summary_df[div_summary_df['Division'] == 'District Total'].iloc[0]
    
    payments_actual = tot_row['Total Payments']
    active_clubs_actual = tot_row['Active Clubs']
    dist_clubs_actual = tot_row['Distinguished Clubs']
    base_clubs = tot_row['Base Clubs']
    
    base_payments = 8634
    dist_payments = round(base_payments * 1.01)
    select_payments = round(base_payments * 1.03)
    pres_payments = round(base_payments * 1.05)
    smedley_payments = round(base_payments * 1.08)
    
    dist_clubs_goal = round(0.40 * base_clubs)
    
    goals_rows = [
        {'Metric Category': 'Payments', 'Goal Name': 'Base Payments', 'Target Goal': base_payments, 'Actual To Date': payments_actual, 'Pending Goal': max(0, base_payments - payments_actual)},
        {'Metric Category': 'Payments', 'Goal Name': 'Distinguished (1%)', 'Target Goal': dist_payments, 'Actual To Date': payments_actual, 'Pending Goal': max(0, dist_payments - payments_actual)},
        {'Metric Category': 'Payments', 'Goal Name': 'Select Distinguished (3%)', 'Target Goal': select_payments, 'Actual To Date': payments_actual, 'Pending Goal': max(0, select_payments - payments_actual)},
        {'Metric Category': 'Payments', 'Goal Name': "President's Distinguished (5%)", 'Target Goal': pres_payments, 'Actual To Date': payments_actual, 'Pending Goal': max(0, pres_payments - payments_actual)},
        {'Metric Category': 'Payments', 'Goal Name': 'Smedley Distinguished (8%)', 'Target Goal': smedley_payments, 'Actual To Date': payments_actual, 'Pending Goal': max(0, smedley_payments - payments_actual)},
        
        {'Metric Category': 'Clubs', 'Goal Name': 'Base Clubs', 'Target Goal': base_clubs, 'Actual To Date': active_clubs_actual, 'Pending Goal': max(0, base_clubs - active_clubs_actual)},
        {'Metric Category': 'Clubs', 'Goal Name': 'Distinguished', 'Target Goal': base_clubs, 'Actual To Date': active_clubs_actual, 'Pending Goal': max(0, base_clubs - active_clubs_actual)},
        {'Metric Category': 'Clubs', 'Goal Name': 'Select Distinguished', 'Target Goal': 184, 'Actual To Date': active_clubs_actual, 'Pending Goal': max(0, 184 - active_clubs_actual)},
        {'Metric Category': 'Clubs', 'Goal Name': "President's Distinguished", 'Target Goal': 194, 'Actual To Date': active_clubs_actual, 'Pending Goal': max(0, 194 - active_clubs_actual)},
        {'Metric Category': 'Clubs', 'Goal Name': 'Smedley Distinguished', 'Target Goal': 197, 'Actual To Date': active_clubs_actual, 'Pending Goal': max(0, 197 - active_clubs_actual)},
        
        {'Metric Category': 'Distinguished Clubs', 'Goal Name': 'Prerequisite', 'Target Goal': 0, 'Actual To Date': dist_clubs_actual, 'Pending Goal': 0},
        {'Metric Category': 'Distinguished Clubs', 'Goal Name': 'Distinguished (40%)', 'Target Goal': dist_clubs_goal, 'Actual To Date': dist_clubs_actual, 'Pending Goal': max(0, dist_clubs_goal - dist_clubs_actual)},
        {'Metric Category': 'Distinguished Clubs', 'Goal Name': 'Select Distinguished', 'Target Goal': 89, 'Actual To Date': dist_clubs_actual, 'Pending Goal': max(0, 89 - dist_clubs_actual)},
        {'Metric Category': 'Distinguished Clubs', 'Goal Name': "President's Distinguished", 'Target Goal': 100, 'Actual To Date': dist_clubs_actual, 'Pending Goal': max(0, 100 - dist_clubs_actual)},
        {'Metric Category': 'Distinguished Clubs', 'Goal Name': 'Smedley Distinguished', 'Target Goal': 108, 'Actual To Date': dist_clubs_actual, 'Pending Goal': max(0, 108 - dist_clubs_actual)},
    ]
    
    return pd.DataFrame(goals_rows)

def process_downloaded_data(data_dir, workspace_dir, timestamp):
    logging.info("📊 Processing downloaded Toastmasters performance data...")
    club_files = glob.glob(os.path.join(data_dir, f"club_performance_{timestamp}.csv"))
    district_files = glob.glob(os.path.join(data_dir, f"district_performance_{timestamp}.csv"))
    div_files = glob.glob(os.path.join(data_dir, f"division_area_performance_{timestamp}.csv"))

    if not (club_files and district_files and div_files):
        logging.error("❌ Cannot process: Missing downloaded performance CSV files.")
        return

    df_cp = pd.read_csv(club_files[0]).dropna(subset=['Club Name'])
    df_dp = pd.read_csv(district_files[0]).dropna(subset=['Club Name'])
    df_div = pd.read_csv(div_files[0]).dropna(subset=['Club Name'])

    # Standardize 'Club' to 'Club Number'
    df_cp['Club Number'] = df_cp['Club Number'].astype(int)
    df_dp['Club'] = df_dp['Club'].astype(int)
    df_div['Club'] = df_div['Club'].astype(int)

    df_dp = df_dp.rename(columns={'Club': 'Club Number'})
    df_div = df_div.rename(columns={'Club': 'Club Number'})

    for df in [df_cp, df_dp, df_div]:
        df['Division'] = df['Division'].astype(str).str.strip()
        df['Area'] = df['Area'].astype(str).str.strip()

    keys = ['District', 'Division', 'Area', 'Club Number', 'Club Name']
    merged = df_cp.merge(df_dp, on=keys, how='outer', suffixes=('', '_dp'))
    merged = merged.merge(df_div, on=keys, how='outer', suffixes=('', '_div'))

    cols = [
        'Club Number', 'District', 'Division', 'Area', 'Club Name', 'Club Status',
        'Mem. Base', 'Active Members', 'Goals Met',
        'New', 'Oct. Ren.', 'Apr. Ren.', 'Total to Date'
    ]
    
    for col in cols:
        if col not in merged.columns:
            merged[col] = 0
            
    final_df = merged[cols].copy()
    final_df = final_df.rename(columns={
        'Mem. Base': 'Base Membership',
        'Active Members': 'Active Membership',
        'New': 'New Member Payments',
        'Oct. Ren.': 'September Renewals',
        'Apr. Ren.': 'March Renewals',
        'Total to Date': 'Total Payments'
    })
    
    final_df = final_df.sort_values(by=['Division', 'Area', 'Club Number']).reset_index(drop=True)
    master_df = compute_master_metrics(final_df)

    # 1. Export Master CSV & JSON & Excel (.xlsx)
    master_csv_path = os.path.join(workspace_dir, "District 121 - Mastersheet.csv")
    master_df.to_csv(master_csv_path, index=False)
    logging.info(f"✅ Saved Master Sheet CSV: {master_csv_path}")

    master_json_path = os.path.join(workspace_dir, "District 121 - Mastersheet.json")
    master_df.to_json(master_json_path, orient="records", indent=2)
    logging.info(f"✅ Saved Master Sheet JSON: {master_json_path}")

    master_excel_path = os.path.join(workspace_dir, "District 121 - Mastersheet.xlsx")
    master_df.to_excel(master_excel_path, index=False)
    logging.info(f"✅ Saved Master Sheet Excel: {master_excel_path}")

    # 2. Export Division Summary
    div_summary_df = build_division_summary(master_df)
    div_summary_csv = os.path.join(workspace_dir, "District 121 - Division Summary.csv")
    div_summary_df.to_csv(div_summary_csv, index=False)
    logging.info(f"✅ Saved Division Summary CSV: {div_summary_csv}")

    # 3. Export Area Summary
    area_summary_df = build_area_summary(master_df)
    area_summary_csv = os.path.join(workspace_dir, "District 121 - Area Summary.csv")
    area_summary_df.to_csv(area_summary_csv, index=False)
    logging.info(f"✅ Saved Area Summary CSV: {area_summary_csv}")

    # 4. Export Dashboard Goals
    dashboard_df = build_dashboard_goals(master_df, div_summary_df)
    dashboard_csv = os.path.join(workspace_dir, "District 121 - Dashboard.csv")
    dashboard_df.to_csv(dashboard_csv, index=False)
    logging.info(f"✅ Saved District Dashboard CSV: {dashboard_csv}")

    # 5. Export Per-Division Detail CSVs
    divisions_dir = os.path.join(workspace_dir, "divisions")
    os.makedirs(divisions_dir, exist_ok=True)
    divisions = sorted(master_df['Division'].dropna().unique().tolist())
    for div in divisions:
        div_df = master_df[master_df['Division'] == div]
        div_csv_path = os.path.join(divisions_dir, f"Division_{div}.csv")
        div_df.to_csv(div_csv_path, index=False)
    logging.info(f"✅ Saved {len(divisions)} individual Division CSVs to {divisions_dir}")

    # Clean downloaded temp raw CSVs
    for f in club_files + district_files + div_files:
        try:
            os.remove(f)
            logging.info(f"🗑️ Cleaned temp file: {f}")
        except Exception as e:
            logging.warning(f"Could not remove {f}: {e}")
>>>>>>> 1699800 (Update download pipeline and generate CSV, JSON, and Excel master outputs)

def run_toastmasters_pipeline():
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    logging.info("🚀 Starting Toastmasters Download & Mastersheet Pipeline...")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        for target_name, target_url in TARGET_PAGES.items():
            try:
                download_csv_from_url(page, target_name, target_url, timestamp)
            except Exception as e:
<<<<<<< HEAD
                logging.error(f"Failed processing {target_name}: {str(e)}")
=======
                logging.error(f"❌ Failed downloading {target_name}: {str(e)}")
>>>>>>> 1699800 (Update download pipeline and generate CSV, JSON, and Excel master outputs)
                
        browser.close()
        
    data_dir = os.path.join(os.getcwd(), "data")
<<<<<<< HEAD
    merge_csvs(data_dir, timestamp)
    logging.info("Automation pipeline execution complete!")
=======
    process_downloaded_data(data_dir, os.getcwd(), timestamp)
    logging.info("🎉 Pipeline execution complete!")
>>>>>>> 1699800 (Update download pipeline and generate CSV, JSON, and Excel master outputs)

if __name__ == "__main__":
    setup_logging()
    run_toastmasters_pipeline()
