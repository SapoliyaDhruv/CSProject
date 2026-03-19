function checkPassword() {
    let password = document.getElementById("password").value;

    let strengthBar = document.getElementById("strength-bar");
    let strengthText = document.getElementById("strength-text");
    let suggestions = document.getElementById("suggestions");
    let crackTime = document.getElementById("crack-time");

    suggestions.innerHTML = "";

    if (password.length === 0) {
        strengthBar.style.width = "0%";
        strengthText.innerText = "Strength:";
        crackTime.innerText = "";
        return;
    }

    //Use zxcvbn
    let result = zxcvbn(password);

    // Score (0–4)
    let score = result.score;

    // Strength Meter
    let colors = ["red", "orange", "yellow", "lightgreen", "green"];
    let texts = ["Very Weak", "Weak", "Medium", "Strong", "Very Strong"];

    strengthBar.style.width = (score + 1) * 20 + "%";
    strengthBar.style.background = colors[score];

    strengthText.innerText = "Strength: " + texts[score];

    //Crack Time
    crackTime.innerText =
        "Time to crack: " +
        result.crack_times_display.offline_fast_hashing_1e10_per_second;
        result.crack_times_display.offline_slow_hashing_1e4_per_second;

    //Suggestions
    if (result.feedback.warning) {
        suggestions.innerHTML += "<li>" + result.feedback.warning + "</li>";
    }

    result.feedback.suggestions.forEach(function (sug) {
        suggestions.innerHTML += "<li>" + sug + "</li>";
    });
}

//Password Generator
function generatePassword() {
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
    let password = "";

    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    document.getElementById("generated-password").innerText =
        "Generated: " + password;
}