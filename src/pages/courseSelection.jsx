import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";

function CourseSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const rmpUrl = location.state?.rmpUrl ?? "";

  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rmpUrl) {
      setError(
        "No professor URL found. Go back and provide a RateMyProfessors professor URL first."
      );
      return;
    }

    async function fetchCourses() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/reviews/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ professorUrl: rmpUrl }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          const errorMessage = data?.details
            ? `${data.error ?? "Unable to fetch courses."} (${data.details})`
            : (data.error ?? "Unable to fetch courses.");
          throw new Error(errorMessage);
        }

        const coursesArray = data.courses || [];
        setCourses(coursesArray);

        // Select all courses by default
        setSelectedCourses(new Set(coursesArray));
      } catch (fetchError) {
        setError(fetchError.message || "Unable to fetch courses");
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, [rmpUrl]);

  function toggleCourse(course) {
    const newSelected = new Set(selectedCourses);
    if (newSelected.has(course)) {
      newSelected.delete(course);
    } else {
      newSelected.add(course);
    }
    setSelectedCourses(newSelected);
  }

  function selectAll() {
    setSelectedCourses(new Set(courses));
  }

  function deselectAll() {
    setSelectedCourses(new Set());
  }

  function handleContinue() {
    if (selectedCourses.size === 0) {
      setError("Please select at least one course to continue.");
      return;
    }

    navigate("/summary", {
      state: {
        rmpUrl,
        selectedCourses: Array.from(selectedCourses),
      },
    });
  }

  if (loading) {
    return (
      <section className="course-page">
        <Card title="Select Courses to Analyze">
          <div className="status-panel" role="status" aria-live="polite">
            <Spinner />
            <p>Loading courses...</p>
          </div>
        </Card>
      </section>
    );
  }

  if (error && !rmpUrl) {
    return (
      <section className="course-page">
        <Card title="Course selection unavailable">
          <div className="stack">
            <div role="alert" className="status-panel status-panel--error">
              <p>{error}</p>
            </div>
            <div className="row">
              <Button type="button" onClick={() => navigate("/endScore")}>
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  if (error) {
    return (
      <section className="course-page">
        <Card title="Unable to load courses">
          <div className="stack">
            <div role="alert" className="status-panel status-panel--error">
              <p>{error}</p>
            </div>
            <div className="row">
              <Button type="button" onClick={() => navigate("/endScore")}>
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  if (courses.length === 0) {
    return (
      <section className="course-page">
        <Card title="No courses found">
          <div className="stack">
            <p className="subtle">No courses were found for this professor.</p>
            <div className="row">
              <Button type="button" onClick={() => navigate("/endScore")}>
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="course-page stack">
      <Card title="Select Courses to Analyze">
        <div className="stack">
          <p className="subtle">
            Choose which courses you want to include in the review summary and analysis.
          </p>

          <div className="row">
            <Button type="button" size="sm" variant="secondary" onClick={selectAll}>
              Select All
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={deselectAll}>
              Deselect All
            </Button>
            <span className="course-count">
              Selected: {selectedCourses.size} of {courses.length}
            </span>
          </div>

          <div className="course-grid">
            {courses.map((course) => {
              const isSelected = selectedCourses.has(course);

              return (
                <label
                  key={course}
                  className={`course-item${isSelected ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCourse(course)}
                  />
                  <span>{course}</span>
                </label>
              );
            })}
          </div>

          <div className="row">
            <Button
              type="button"
              onClick={handleContinue}
              disabled={selectedCourses.size === 0}
            >
              Continue to Summary
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/endScore")}
            >
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

export default CourseSelection;
