from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import pandas as pd
import time
import re


def scrape_all_reviews(professor_url):
    options = Options()
    options.add_argument("--headless")  # remove to see browser
    options.add_argument("--start-maximized")
    options.add_argument("--user-agent=Mozilla/5.0")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )

    driver.get(professor_url)
    wait = WebDriverWait(driver, 20)

    # 🔥 Extract professor ID from URL
    professor_id = professor_url.rstrip("/").split("/")[-1]

    # Get school ID (from school link or URL)
    try:
        # Try to find school link and extract ID from href
        school_link = driver.find_element(By.XPATH, "//a[contains(@href,'/school/')]")
        school_href = school_link.get_attribute("href")
        school_id = school_href.rstrip("/").split("/")[-1]
    except:
        school_id = "Unknown"

    # Get professor name
    try:
        professor_name = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "h1"))
        ).text
    except:
        professor_name = "Unknown"

    # Get school name (usually in a span or div near the top)
    try:
        # Try common selectors for school name
        school_elem = driver.find_element(By.XPATH, "//div[contains(@class,'NameTitle__School')] | //span[contains(@class,'SchoolName')] | //div[contains(@class,'TeacherInfo__School')] | //a[contains(@href,'/school/')]")
        school_name = school_elem.text.strip()
    except:
        school_name = "Unknown"

    # Wait for reviews
    wait.until(EC.presence_of_element_located(
        (By.XPATH, "//div[contains(@class,'Rating__RatingBody')]")
    ))

    # Click "Load More" until all reviews are loaded (robust)
    max_attempts = 50  # failsafe to avoid infinite loop
    attempts = 0
    last_count = 0
    while attempts < max_attempts:
        review_cards = driver.find_elements(By.XPATH, "//div[contains(@class,'Rating__RatingBody')]")
        current_count = len(review_cards)
        try:
            load_more = driver.find_element(By.XPATH, "//button[contains(text(),'Load More')]")
            driver.execute_script("arguments[0].click();", load_more)
            # Wait for new reviews to load
            for _ in range(10):
                time.sleep(1)
                review_cards = driver.find_elements(By.XPATH, "//div[contains(@class,'Rating__RatingBody')]")
                if len(review_cards) > current_count:
                    break
            attempts += 1
        except:
            break
        # If no new reviews loaded, break
        if len(review_cards) == last_count:
            break
        last_count = len(review_cards)

    review_cards = driver.find_elements(By.XPATH, "//div[contains(@class,'Rating__RatingBody')]")

    reviews_data = []

    month_pattern = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"

    for card in review_cards:
        full_text = card.get_attribute("innerText").strip()
        lines = [line.strip() for line in full_text.split("\n") if line.strip()]

        course = None
        date = None
        rating = None

        # Identify date
        for line in lines:
            if re.search(month_pattern, line):
                date = line
                break

        # Identify course
        for line in lines:
            if line.isupper() and len(line) <= 15 and any(char.isdigit() for char in line):
                course = line
                break

        # Identify rating
        for line in lines:
            if re.match(r"^\d\.\d$", line):
                rating = line
                break

        comment = max(lines, key=len) if lines else None

        reviews_data.append({
            "professor_id": professor_id,
            "professor_name": professor_name,
            "school": school_name,
            "school_id": school_id,
            "course": course,
            "rating": rating,
            "date": date,
            "comment": comment
        })

    driver.quit()

    return pd.DataFrame(reviews_data)


# 🔹 Replace with real professor URL
url = "https://www.ratemyprofessors.com/professor/2348540"
df = scrape_all_reviews(url)

# Clean data
df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
df.drop_duplicates(inplace=True)

# Save to CSV
professor_id = df["professor_id"].iloc[0]
csv_filename = f"{professor_id}.csv"
df.to_csv(csv_filename, index=False, encoding="utf-8")

print("Scraped", len(df), "reviews")
print(df.head())