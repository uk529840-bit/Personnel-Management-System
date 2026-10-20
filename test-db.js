const db = require("./db");

db.query("SHOW TABLES", (error, results) => {
    if (error) {
        console.error("Database test failed:", error.message);
        process.exitCode = 1;
    } else {
        console.log("Database test successful!");
        console.table(results);
    }

    db.end();
});
