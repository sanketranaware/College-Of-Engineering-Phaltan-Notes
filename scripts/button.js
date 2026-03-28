// main course Btn
let degreeDiv = document.getElementById("degree-main");
let diplomaDiv = document.getElementById("diploma-main");

let degreeBtn = document.getElementById("degreeBtn");
let diplomaBtn = document.getElementById("diplomaBtn");

degreeBtn.addEventListener("click", () => {
    console.log("Degree clicked");

    degreeDiv.style.display = "flex";
    diplomaDiv.style.display = "none";

    degreeBtn.classList.add("active");
    diplomaBtn.classList.remove("active");
});

diplomaBtn.addEventListener("click", () => {
    console.log("Diploma clicked");

    diplomaDiv.style.display = "flex";
    degreeDiv.style.display = "none";

    diplomaBtn.classList.add("active");
    degreeBtn.classList.remove("active");
});


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