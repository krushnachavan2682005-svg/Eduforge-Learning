import pytest
from utils.config import Config
from pages.login_page import LoginPage
from pages.teacher_dashboard import TeacherDashboard
from pages.student_dashboard import StudentDashboard
import time

@pytest.mark.e2e
class TestEduforgeE2E:
    
    assessment_title = "Eduforge Automated E2E Assessment"
    
    def test_e2e_workflow(self, browser):
        """
        Executes the full Eduforge Learning E2E Cycle:
        Phase 1: Teacher Setup & Assignment
        Phase 2: Student Attempt & Submission
        Phase 3: Teacher Grading & Result Verification
        """
        
        # Initialize Page Objects
        login_page = LoginPage(browser)
        teacher_dashboard = TeacherDashboard(browser)
        student_dashboard = StudentDashboard(browser)
        
        # ==========================================
        # Phase 1: Teacher Setup & Assignment
        # ==========================================
        login_page.go_to()
        time.sleep(2)  # Temporary sleep to visually confirm page rendering
        login_page.login(Config.TEACHER_EMAIL, Config.TEACHER_PASSWORD)
        
        teacher_dashboard.create_assessment(self.assessment_title, Config.STUDENT_EMAIL)
        
        login_page.logout()
        
        # ==========================================
        # Phase 2: Student Attempt & Submission
        # ==========================================
        login_page.login(Config.STUDENT_EMAIL, Config.STUDENT_PASSWORD)
        
        student_dashboard.navigate_to_pending_tests()
        student_dashboard.start_assessment(self.assessment_title)
        student_dashboard.complete_and_submit_assessment()
        
        # Assert submission status changes to "Submitted" / "Awaiting Grading"
        assert student_dashboard.verify_submission_status(), "Student submission status was not displayed."
        
        login_page.logout()
        
        # ==========================================
        # Phase 3: Teacher Grading & Result Verification
        # ==========================================
        login_page.login(Config.TEACHER_EMAIL, Config.TEACHER_PASSWORD)
        
        teacher_dashboard.navigate_to_gradebook()
        teacher_dashboard.open_student_submission(Config.STUDENT_EMAIL)
        teacher_dashboard.grade_submission(10)
        
        # Final Assertion: Verify the state updates to "Graded" / "Published"
        final_status = teacher_dashboard.get_submission_status(Config.STUDENT_EMAIL)
        assert any(status in final_status for status in ["Graded", "Published"]), f"Expected Graded/Published status, got: {final_status}"
        
        login_page.logout()
