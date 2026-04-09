// main course Btn
let degreeDiv = document.getElementById("degree-main");
let diplomaDiv = document.getElementById("diploma-main");

let degreeBtn = document.getElementById("degreeBtn");
let diplomaBtn = document.getElementById("diplomaBtn");

// Check if we're on the index page
if (degreeDiv && diplomaDiv && degreeBtn && diplomaBtn) {

    // Load and display branches for degree
    async function loadDegreeCourses() {
        try {
            const response = await fetch('courses.html');
            const html = await response.text();
            // Extract the container from courses page and load data
            degreeDiv.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading branches...</p></div>';

            // Instead, let's redirect to courses page with program param
            window.location.href = "courses.html?program=degree";
        } catch (err) {
            degreeDiv.innerHTML = '<p style="color:red;text-align:center;">Error loading branches</p>';
        }
    }

    // Load and display branches for diploma  
    async function loadDiplomaCourses() {
        try {
            diplomaDiv.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading branches...</p></div>';
            window.location.href = "courses.html?program=diploma";
        } catch (err) {
            diplomaDiv.innerHTML = '<p style="color:red;text-align:center;">Error loading branches</p>';
        }
    }

    degreeBtn.addEventListener("click", loadDegreeCourses);
    diplomaBtn.addEventListener("click", loadDiplomaCourses);
}


// footer course Btn
let degree = document.querySelector("#degree");
let diploma = document.querySelector("#diploma");

let degreeFooterBtn = document.getElementById("degreeFooterBtn");
let diplomaFooterBtn = document.getElementById("diplomaFooterBtn");

function showDegreeFooter() {
    degree.style.display = "block";
    diploma.style.display = "none";

    degreeFooterBtn.classList.add("active");
    diplomaFooterBtn.classList.remove("active");
}

function showDiplomaFooter() {
    diploma.style.display = "block";
    degree.style.display = "none";

    diplomaFooterBtn.classList.add("active");
    degreeFooterBtn.classList.remove("active");
}