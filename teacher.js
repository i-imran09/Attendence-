// teacher.js

document.addEventListener("DOMContentLoaded", function() {
  // Display teacher info from localStorage
  const teacherId = localStorage.getItem("teacherId");
  const teacherName = localStorage.getItem("teacherName");
  const teacherSection = localStorage.getItem("teacherSection");
  document.getElementById("teacherIdDisplay").innerText = "ID: " + teacherId;
  document.getElementById("teacherNameDisplay").innerText = "Name: " + teacherName;
  
  // Open default tab (Add Student)
  document.getElementsByClassName("tablink")[0].click();
  
  // Load initial data for attendance and student list
  loadAttendanceForm();
  loadTeacherStudentList();
});

// Tab switching function
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

// --- Add Student Functionality ---
document.getElementById("addStudentForm").addEventListener("submit", function(e) {
  e.preventDefault();
  const teacherId = localStorage.getItem("teacherId");
  const teacherSection = localStorage.getItem("teacherSection");
  const studentName = document.getElementById("studentName").value.trim();
  const fatherName = document.getElementById("fatherName").value.trim();
  const parentPhone = document.getElementById("parentPhone").value.trim();
  const email = document.getElementById("email").value.trim();
  const bloodGroup = document.getElementById("bloodGroup").value.trim();
  
  // Auto-generate student ID (e.g., S001, S002, etc.)
  db.collection("students").get().then(snapshot => {
    const count = snapshot.size + 1;
    const studentId = "S" + String(count).padStart(3, '0');
    db.collection("students").doc(studentId).set({
      teacherId: teacherId,  // Store teacherId for filtering
      name: studentName,
      fatherName: fatherName,
      parentPhone: parentPhone,
      email: email,
      bloodGroup: bloodGroup,
      section: teacherSection
    }).then(() => {
      document.getElementById("addStudentMsg").innerText = "Student added successfully with ID: " + studentId;
      document.getElementById("addStudentForm").reset();
      loadTeacherStudentList(); // Refresh student list
      loadAttendanceForm();     // Refresh attendance form if needed
    }).catch(err => {
      document.getElementById("addStudentMsg").innerText = "Error adding student: " + err.message;
    });
  });
});

// --- Build Attendance Form ---
function loadAttendanceForm(){
  const teacherSection = localStorage.getItem("teacherSection");
  db.collection("students").where("section", "==", teacherSection).get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `<div class="attendance-item">
        <span>${doc.id} - ${data.name}</span>
        <label><input type="radio" name="att_${doc.id}" value="Present" required> Present</label>
        <label><input type="radio" name="att_${doc.id}" value="Absent"> Absent</label>
      </div>`;
    });
    document.getElementById("studentAttendanceList").innerHTML = html;
  });
}

// --- Mark Attendance Submission ---
document.getElementById("attendanceForm").addEventListener("submit", function(e){
  e.preventDefault();
  if(confirm("Are you sure you want to submit attendance?")){
    const teacherId = localStorage.getItem("teacherId");
    const teacherSection = localStorage.getItem("teacherSection");
    const today = new Date().toISOString().slice(0,10);
    let attendanceData = {};
    
    const attendanceItems = document.querySelectorAll(".attendance-item");
    attendanceItems.forEach(item => {
      const studentId = item.querySelector("span").innerText.split(" - ")[0];
      const status = document.querySelector(`input[name="att_${studentId}"]:checked`).value;
      attendanceData[studentId] = status;
    });
    
    db.collection("attendance").add({
      teacherId: teacherId,
      section: teacherSection,
      date: today,
      attendance: attendanceData
    }).then(() => {
      alert("Attendance submitted successfully.");
    }).catch(err => {
      alert("Error submitting attendance: " + err.message);
    });
  }
});

// --- Load Teacher's Student List with Delete Option ---
function loadTeacherStudentList(){
  const teacherId = localStorage.getItem("teacherId");
  // Query students added by this teacher
  db.collection("students").where("teacherId", "==", teacherId).get().then(snapshot => {
    let html = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      html += `<tr>
        <td>${doc.id}</td>
        <td>${data.name}</td>
        <td>${data.fatherName}</td>
        <td>${data.parentPhone}</td>
        <td>${data.email}</td>
        <td>${data.bloodGroup}</td>
        <td><button onclick="deleteStudent('${doc.id}')">Delete</button></td>
      </tr>`;
    });
    document.querySelector("#studentListTable tbody").innerHTML = html;
  }).catch(err => {
    console.error("Error loading student list:", err);
  });
}

// --- Delete Student ---
function deleteStudent(studentId){
  if(confirm("Are you sure you want to delete student " + studentId + "?")){
    db.collection("students").doc(studentId).delete().then(() => {
      loadTeacherStudentList();
      loadAttendanceForm();
    }).catch(err => {
      alert("Error deleting student: " + err.message);
    });
  }
}
// --- Teacher Search Functionality ---
document.getElementById("teacherSearchForm").addEventListener("submit", function(e){
  e.preventDefault();
  const query = document.getElementById("teacherSearchInput").value.trim();
  let resultsHtml = "";
  // Search by student document ID
  db.collection("students").doc(query).get().then(doc => {
    if(doc.exists){
      const data = doc.data();
      resultsHtml += `<p>ID: ${doc.id} | Name: ${data.name} | Section: ${data.section}</p>`;
    }
    // Also search by name
    db.collection("students").where("name", "==", query).get().then(snapshot2 => {
      snapshot2.forEach(doc => {
        const data = doc.data();
        resultsHtml += `<p>ID: ${doc.id} | Name: ${data.name} | Section: ${data.section}</p>`;
      });
      document.getElementById("teacherSearchResults").innerHTML = resultsHtml || "No results found.";
    });
  });
});