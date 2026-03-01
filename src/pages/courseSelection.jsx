import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
      } catch (error) {
        setError(error.message || "Unable to fetch courses");
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

  if (error && !rmpUrl) {
    return (
      <div>
        <p role="alert" style={{ color: "red" }}>{error}</p>
        <button onClick={() => navigate("/endScore")}>Go Back</button>
      </div>
    );
  }

  if (loading) {
    return <p>Loading courses...</p>;
  }

  if (error) {
    return (
      <div>
        <p role="alert" style={{ color: "red" }}>{error}</p>
        <button onClick={() => navigate("/endScore")}>Go Back</button>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div>
        <p>No courses found for this professor.</p>
        <button onClick={() => navigate("/endScore")}>Go Back</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Select Courses to Analyze</h2>
      <p>Choose which courses you want to include in the review summary and analysis:</p>

      <div style={{ marginBottom: "20px" }}>
        <button onClick={selectAll} style={{ marginRight: "10px" }}>
          Select All
        </button>
        <button onClick={deselectAll}>Deselect All</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {courses.map((course) => (
          <label
            key={course}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              backgroundColor: selectedCourses.has(course) ? "#e0f0ff" : "#fff",
            }}
          >
            <input
              type="checkbox"
              checked={selectedCourses.has(course)}
              onChange={() => toggleCourse(course)}
              style={{ marginRight: "8px" }}
            />
            <span>{course}</span>
          </label>
        ))}
      </div>

      <div style={{ marginTop: "20px" }}>
        <p>
          <strong>Selected: {selectedCourses.size}</strong> of {courses.length} courses
        </p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          onClick={handleContinue}
          disabled={selectedCourses.size === 0}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            cursor: selectedCourses.size === 0 ? "not-allowed" : "pointer",
            opacity: selectedCourses.size === 0 ? 0.5 : 1,
          }}
        >
          Continue to Summary
        </button>
        <button
          onClick={() => navigate("/endScore")}
          style={{ marginLeft: "10px", padding: "10px 20px", fontSize: "16px" }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}

export default CourseSelection;
