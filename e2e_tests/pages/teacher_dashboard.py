from selenium.webdriver.common.by import By
from pages.base_page import BasePage
from utils.config import Config

class TeacherDashboard(BasePage):
    """Page object for the Teacher Dashboard and interactions."""
    
    # --- Locators ---
    CREATE_TEST_BTN = (By.CSS_SELECTOR, "ul.nav-list > div:nth-child(4) > div.nav-link")
    TEST_TITLE_INPUT = (By.CSS_SELECTOR, "input[formcontrolname='title']")
    TEST_TOTAL_MARKS_INPUT = (By.CSS_SELECTOR, "input[formcontrolname='total_marks']")
    TEST_PASSING_MARKS_INPUT = (By.CSS_SELECTOR, "input[formcontrolname='passing_marks']")
    TEST_DURATION_INPUT = (By.CSS_SELECTOR, "input[formcontrolname='duration_minutes']")
    TEST_DATE_TOGGLE = (By.CSS_SELECTOR, "app-calendar > div")
    TEST_REVIEWERS_DROPDOWN = (By.CSS_SELECTOR, "ng-select[formcontrolname='reviewers']")
    SAVE_TEST_DETAILS_BTN = (By.XPATH, "//button[contains(normalize-space(text()), 'Save Test Details')]")
    MCQ_TAB_BTN = (By.XPATH, "//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'mcq')]")
    Q_MARKS_INPUT = (By.XPATH, "//input[@placeholder='Enter marks']")
    Q_TEXT_INPUT = (By.XPATH, "//input[@placeholder='Enter quiz question']")
    Q_OPT_A_INPUT = (By.XPATH, "(//input[@placeholder='Enter option'])[1]")
    Q_OPT_B_INPUT = (By.XPATH, "(//input[@placeholder='Enter option'])[2]")
    Q_CORRECT_ANS_DROPDOWN = (By.XPATH, "//ng-select[@placeholder='Select correct answer']")
    SAVE_TEST_BTN = (By.CSS_SELECTOR, "button[type='submit']")
    
    # New Locators for the split UI (Assign Test is now a separate view)
    ASSIGN_TEST_SIDEBAR_BTN = (By.CSS_SELECTOR, "ul.nav-list > div:nth-child(5) > div.nav-link")
    ASSIGN_CATEGORY_DROPDOWN = (By.CSS_SELECTOR, "ng-select[formcontrolname='selectedCategory']")
    ASSIGN_STUDENT_DROPDOWN = (By.CSS_SELECTOR, "ng-select[formcontrolname='selectedUser']")
    ASSIGN_TEST_DROPDOWN = (By.CSS_SELECTOR, "ng-select[formcontrolname='selectedTest']")
    CONFIRM_ASSIGN_BTN = (By.CSS_SELECTOR, "button:not([disabled]).theme-bg-secondary.theme-border.theme-bg-gray")
    
    # Grading Locators
    GRADEBOOK_TAB = (By.XPATH, "//a[contains(text(), 'Gradebook') or contains(text(), 'Evaluation')]")
    SUBMISSION_SCORE_INPUT = (By.CSS_SELECTOR, "input[type='number'], input[formcontrolname='score']")
    SAVE_GRADE_BTN = (By.XPATH, "//button[contains(text(), 'Save Grade') or contains(text(), 'Publish Grade')]")
    STATUS_TEXT = (By.XPATH, "//*[contains(@class, 'status') or contains(@class, 'badge')]")

    def __init__(self, driver):
        super().__init__(driver)

    def create_assessment(self, title, student_email):
        """Creates a new assessment and assigns it to a student using the new sidebar UI."""
        import time
        time.sleep(3) # Wait for login navigation to complete
        
        # 1. Click 'Create Test' from Sidebar
        self.click(self.CREATE_TEST_BTN)
        time.sleep(2)
        
        # 2. Fill in the Title and required fields
        self.send_keys(self.TEST_TITLE_INPUT, title)
        self.send_keys(self.TEST_TOTAL_MARKS_INPUT, "100")
        self.send_keys(self.TEST_PASSING_MARKS_INPUT, "50")
        self.send_keys(self.TEST_DURATION_INPUT, "60")
        
        # Set date via custom calendar
        self.click(self.TEST_DATE_TOGGLE)
        available_day = (By.XPATH, "(//app-calendar//div[contains(@class, 'cursor-pointer') and not(contains(@class, 'cursor-not-allowed')) and normalize-space(text())!=''])[last()]")
        self.click(available_day)
        
        # Select Time (HH, MM, AM/PM)
        self.click((By.XPATH, "//ng-select[@placeholder='HH']"))
        self.click((By.XPATH, "//div[contains(@class, 'ng-option')]"))
        self.click((By.XPATH, "//ng-select[@placeholder='MM']"))
        self.click((By.XPATH, "//div[contains(@class, 'ng-option')]"))
        self.click((By.XPATH, "//ng-select[@placeholder='AM/PM']"))
        self.click((By.XPATH, "//div[contains(@class, 'ng-option')]"))
        
        # Select reviewer
        self.click(self.TEST_REVIEWERS_DROPDOWN)
        self.click((By.XPATH, "//div[contains(@class, 'ng-option')]")) # Select first reviewer
        
        # Save Test Details to reveal question form
        self.click(self.SAVE_TEST_DETAILS_BTN)
        time.sleep(1)
        
        # Select MCQ
        self.click(self.MCQ_TAB_BTN)
        time.sleep(1)
        
        # Add a question to match total marks
        self.send_keys(self.Q_MARKS_INPUT, "100")
        self.send_keys(self.Q_TEXT_INPUT, "What is 2+2?")
        self.send_keys(self.Q_OPT_A_INPUT, "4")
        self.send_keys(self.Q_OPT_B_INPUT, "5")
        
        self.click(self.Q_CORRECT_ANS_DROPDOWN)
        self.click((By.XPATH, "//div[contains(@class, 'ng-option')]"))
        
        # Save Test (Submit)
        self.click(self.SAVE_TEST_BTN)
        time.sleep(10) # Wait for test to save and route back
        
        # 3. Navigate to 'Assign Test' from Sidebar
        self.click(self.ASSIGN_TEST_SIDEBAR_BTN)
        time.sleep(2)
        
        # 3.5 Open the Assign Test Sidebar Form
        self.click((By.XPATH, "//button[contains(normalize-space(text()), 'Assign Test') and not(ancestor::ul[contains(@class, 'nav-list')]) ]"))
        time.sleep(1)
        
        # 4. Fill Assign Test Form
        
        # Select Category (e.g., Student)
        self.click(self.ASSIGN_CATEGORY_DROPDOWN)
        self.click((By.XPATH, "//div[contains(@class, 'ng-option') and contains(., 'Student')]"))
        
        # Select Student
        self.click(self.ASSIGN_STUDENT_DROPDOWN)
        student_input = (By.CSS_SELECTOR, "ng-select[formcontrolname='selectedUser'] input")
        self.send_keys(student_input, student_email)
        time.sleep(2)
        student_option = (By.XPATH, f"//div[contains(@class, 'ng-option') and contains(., '{student_email}')]")
        self.click(student_option)
            
        # Select Test
        self.click(self.ASSIGN_TEST_DROPDOWN)
        test_input = (By.CSS_SELECTOR, "ng-select[formcontrolname='selectedTest'] input")
        self.send_keys(test_input, title)
        time.sleep(2)
        test_option = (By.XPATH, f"//div[contains(@class, 'ng-option') and contains(., '{title}')]")
        self.click(test_option)
            
        # Confirm Assignment
        self.click(self.CONFIRM_ASSIGN_BTN)
        time.sleep(2)

    def navigate_to_gradebook(self):
        """Navigates to the evaluation/gradebook tab."""
        self.click(self.GRADEBOOK_TAB)

    def open_student_submission(self, student_email):
        """Finds and clicks on the submission for a specific student."""
        submission_row = (By.XPATH, f"//tr[contains(., '{student_email}')]//button[contains(text(), 'Evaluate') or contains(text(), 'View')]")
        self.click(submission_row)

    def grade_submission(self, score):
        """Inputs a score and publishes the grade."""
        self.send_keys(self.SUBMISSION_SCORE_INPUT, str(score))
        self.click(self.SAVE_GRADE_BTN)
        
    def get_submission_status(self, student_email):
        """Gets the status of a specific student's submission from the gradebook."""
        status_locator = (By.XPATH, f"//tr[contains(., '{student_email}')]//*[contains(@class, 'status') or contains(text(), 'Graded') or contains(text(), 'Published')]")
        return self.get_text(status_locator)
