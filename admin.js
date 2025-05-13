/* admin.js */

// Function for tab switching remains unchanged
function openTab(evt, tabName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.className += " active";
}

// When the DOM is ready, load initial data
document.addEventListener("DOMContentLoaded", function(){
  // Open first tab
  document.getElementsByClassName("tablink")[0].click();
  loadTeacherDetails();
  loadTodayAttendance();
  loadMonthlyData();
});
document.addEventListener("DOMContentLoaded", function() {
  // Attach event listener to the Add Teacher form
  const addTeacherForm = document.getElementById("addTeacherForm");
  addTeacherForm.addEventListener("submit", function(e) {
    e.preventDefault();
    
    // Retrieve and trim input values
    const teacherName = document.getElementById("teacherName").value.trim();
    const teacherSection = document.getElementById("teacherSection").value.trim();
    
    // Validate inputs
    if (!teacherName || !teacherSection) {
      document.getElementById("addTeacherMsg").innerText = "Please fill in all fields.";
      return;
    }
    
    // Auto-generate teacher ID (e.g., T001, T002, etc.)
    db.collection("teachers").get().then(snapshot => {
      const count = snapshot.size + 1;
      const teacherId = "T" + String(count).padStart(3, '0');
      
      // Save the teacher data to Firestore
      return db.collection("teachers").doc(teacherId).set({
        name: teacherName,
        section: teacherSection
      }).then(() => {
        document.getElementById("addTeacherMsg").innerText = "Teacher added successfully with ID: " + teacherId;
        addTeacherForm.reset();
        loadTeacherDetails(); // Refresh the teacher details list if you have this function
      });
    }).catch(err => {
      document.getElementById("addTeacherMsg").innerText = "Error adding teacher: " + err.message;
    });
  });
});


// -----------------------------
// TODAY'S ATTENDANCE FUNCTIONALITY
// -----------------------------
function loadTodayAttendance(){
  const today = new Date().toISOString().slice(0,10); // Format: YYYY-MM-DD
  db.collection("attendance").where("date", "==", today).get().then(snapshot => {
    let html = "";
    let promises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // For each attendance record, query the number of students in the section to get class strength
      let p = db.collection("students").where("section", "==", data.section).get().then(studentSnap => {
        const classStrength = studentSnap.size;
        // Count present students in this attendance record
        let presentCount = 0;
        for (let studentId in data.attendance) {
          if(data.attendance[studentId] === "Present"){
            presentCount++;
          }
        }
        html += `<li>Teacher: ${data.teacherId} | Section: ${data.section} | Class Strength: ${classStrength} | Today Present: ${presentCount}</li>`;
      });
      promises.push(p);
    });
    Promise.all(promises).then(() => {
      document.getElementById("attendanceList").innerHTML = html;
    });
  }).catch(err => {
    console.error("Error loading today's attendance:", err);
  });
}

// -----------------------------
// MONTHLY DATA FUNCTIONALITY
// -----------------------------

// Load unique months from attendance records and list them as clickable links.
function loadMonthlyData(){
  db.collection("attendance").get().then(snapshot => {
    let months = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      // Assume date format is "YYYY-MM-DD"
      const month = data.date.substring(0,7);
      months[month] = true;
    });
    let html = "<h3>Select Month:</h3><ul>";
    for(let month in months){
      html += `<li><a href="#" onclick="loadMonthlyAttendanceForMonth('${month}')">${month}</a></li>`;
    }
    html += "</ul>";
    document.getElementById("monthlyDataContent").innerHTML = html;
  }).catch(err => {
    console.error("Error loading monthly data:", err);
  });
}

// When a month is clicked, load attendance submissions for that month.
// This groups records by teacherId (and its section) so that duplicate entries are avoided.
function loadMonthlyAttendanceForMonth(month){
  const startDate = month + "-01";
  const endDate = month + "-31"; // This simplistic range works for our demo.
  db.collection("attendance")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get().then(snapshot => {
      let teacherAttendance = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        // Group by teacherId. (Assuming one section per teacher.)
        teacherAttendance[data.teacherId] = data.section;
      });
      let html = `<h3>Attendance Submissions for ${month}</h3><ul>`;
      for(let teacherId in teacherAttendance){
         let section = teacherAttendance[teacherId];
         html += `<li>Teacher: <a href="#" onclick="loadTeacherMonthlyAttendance('${teacherId}', '${month}', '${section}')">${teacherId}</a> | Section: ${section}</li>`;
      }
      html += `</ul><p><a href="#" onclick="loadMonthlyData()">Back to Month List</a></p>`;
      document.getElementById("monthlyDataContent").innerHTML = html;
    }).catch(err => {
      console.error("Error loading monthly attendance for month:", err);
    });
}

// When a teacher is clicked, load detailed monthly attendance for that teacher.
// This displays a table with student name, present/absent counts, and attendance percentage.
function loadTeacherMonthlyAttendance(teacherId, month, section){
  const startDate = month + "-01";
  const endDate = month + "-31";
  
  // Query attendance records for the teacher in the given month.
  db.collection("attendance")
    .where("teacherId", "==", teacherId)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get().then(snapshot => {
      let totalDays = snapshot.size; // Total attendance submissions by this teacher in the month.
      let attendanceCounts = {}; // Map each studentId to a count of present days.
      snapshot.forEach(doc => {
        const data = doc.data();
        for(let studentId in data.attendance){
          if(!attendanceCounts[studentId]){
             attendanceCounts[studentId] = { present: 0 };
          }
          if(data.attendance[studentId] === "Present"){
             attendanceCounts[studentId].present++;
          }
        }
      });
      
      // Now, fetch the list of students registered under this teacher and section.
      db.collection("students")
        .where("teacherId", "==", teacherId)
        .where("section", "==", section)
        .get().then(studentSnap => {
           let html = `<h3>Attendance Details for Teacher ${teacherId} (${month})</h3>`;
           html += `<table border="1" cellpadding="5" cellspacing="0">
                      <tr>
                        <th>Student ID</th>
                        <th>Name</th>
                        <th>Present Days</th>
                        <th>Absent Days</th>
                        <th>Attendance %</th>
                      </tr>`;
           studentSnap.forEach(studentDoc => {
             const studentData = studentDoc.data();
             let present = attendanceCounts[studentDoc.id] ? attendanceCounts[studentDoc.id].present : 0;
             let absent = totalDays - present;
             let percentage = totalDays > 0 ? ((present / totalDays) * 100).toFixed(2) : "N/A";
             html += `<tr>
                        <td>${studentDoc.id}</td>
                        <td>${studentData.name}</td>
                        <td>${present}</td>
                        <td>${absent}</td>
                        <td>${percentage}%</td>
                      </tr>`;
           });
           html += `</table>
                    <p><a href="#" onclick="loadMonthlyAttendanceForMonth('${month}')">Back to Attendance Submissions</a></p>`;
           document.getElementById("monthlyDataContent").innerHTML = html;
        }).catch(err => {
          console.error("Error loading student details:", err);
        });
    }).catch(err => {
      console.error("Error loading teacher monthly attendance:", err);
    });
}


// -----------------------------
// OTHER EXISTING FUNCTIONS
// -----------------------------
// (The functions for adding teacher, loading teacher details, search, etc. remain as before)

function loadTeacherDetails(){
  db.collection("teachers").get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `<tr>
        <td>${doc.id}</td>
        <td>${data.name}</td>
        <td>${data.section}</td>
        <td><button onclick="deleteTeacher('${doc.id}')">Delete</button></td>
      </tr>`;
    });
    document.querySelector("#teacherTable tbody").innerHTML = html;
  });
}

function deleteTeacher(teacherId){
  if(confirm("Are you sure you want to delete teacher " + teacherId + "?")){
    db.collection("teachers").doc(teacherId).delete().then(() => {
      loadTeacherDetails();
    }).catch(err => {
      alert("Error deleting teacher: " + err.message);
    });
  }
}

// --- Updated Search Student Functionality in Admin Page ---
document.getElementById("searchForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const query = document.getElementById("searchInput").value.trim();
  
  // Search for student by document ID
  db.collection("students").doc(query).get().then(doc => {
    if (doc.exists) {
      const studentData = doc.data();
      let html = `<h3>Student Details</h3>`;
      html += `<p><strong>ID:</strong> ${doc.id}</p>`;
      html += `<p><strong>Name:</strong> ${studentData.name}</p>`;
      html += `<p><strong>Father's Name:</strong> ${studentData.fatherName || "N/A"}</p>`;
      html += `<p><strong>Mobile No:</strong> ${studentData.parentPhone || "N/A"}</p>`;
      html += `<p><strong>Email:</strong> ${studentData.email || "N/A"}</p>`;
      html += `<p><strong>Section:</strong> ${studentData.section || "N/A"}</p>`;
      
      // Query today's attendance
      const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
      db.collection("attendance").where("date", "==", today).get().then(todaySnap => {
        let todayStatus = "Not Marked";
        todaySnap.forEach(attDoc => {
          const attData = attDoc.data();
          if (attData.attendance && attData.attendance[doc.id] !== undefined) {
            todayStatus = attData.attendance[doc.id];
          }
        });
        html += `<p><strong>Today's Attendance:</strong> ${todayStatus}</p>`;
        
        // Query monthly attendance for current month
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, "0");
        const monthStart = `${year}-${month}-01`;
        const monthEnd = `${year}-${month}-31`; // Simplified range for the month
        
        db.collection("attendance")
          .where("date", ">=", monthStart)
          .where("date", "<=", monthEnd)
          .get().then(monthSnap => {
            let totalRecords = 0;
            let presentCount = 0;
            monthSnap.forEach(monthDoc => {
              const monthData = monthDoc.data();
              if (monthData.attendance && monthData.attendance[doc.id] !== undefined) {
                totalRecords++;
                if (monthData.attendance[doc.id] === "Present") {
                  presentCount++;
                }
              }
            });
            const percentage = totalRecords > 0 ? ((presentCount / totalRecords) * 100).toFixed(2) : "N/A";
            html += `<p><strong>Monthly Attendance Percentage:</strong> ${percentage}%</p>`;
            document.getElementById("searchResults").innerHTML = html;
          }).catch(err => {
            document.getElementById("searchResults").innerHTML = "Error fetching monthly attendance: " + err.message;
          });
      }).catch(err => {
        document.getElementById("searchResults").innerHTML = "Error fetching today's attendance: " + err.message;
      });
    } else {
      document.getElementById("searchResults").innerHTML = `<p>No student found with ID: ${query}</p>`;
    }
  }).catch(err => {
    document.getElementById("searchResults").innerHTML = "Error: " + err.message;
  });
});