'use strict';

const readline = require('node:readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const GRADE_SCALE = [
    { min: 90, grade: 'A+' },
    { min: 80, grade: 'A' },
    { min: 70, grade: 'B+' },
    { min: 60, grade: 'B' },
    { min: 50, grade: 'C' },
    { min: 40, grade: 'D' },
    { min: 0, grade: 'F' }
];

function askForNumber(prompt, validate, errorMessage, callback) {
    rl.question(prompt, (answer) => {
        const value = Number(answer.trim());
        if (answer.trim() === '' || !Number.isFinite(value) || !validate(value)) {
            console.log(errorMessage);
            askForNumber(prompt, validate, errorMessage, callback);
            return;
        }
        callback(value);
    });
}

console.log('\n=================================');
console.log('   EXAM MARKS CALCULATOR APP   ');
console.log('=================================\n');

askForNumber(
    'Total kitne subjects hain? ',
    (value) => Number.isSafeInteger(value) && value > 0,
    'Valid positive whole number enter karein.',
    (numSubjects) => {
        let totalMaxMarks = 0;
        let totalObtainedMarks = 0;
        let current = 1;

        function askMarks() {
            if (current > numSubjects) {
                const percentage = (totalObtainedMarks / totalMaxMarks) * 100;
                const grade = GRADE_SCALE.find((entry) => percentage >= entry.min).grade;

                console.log('\n=================================');
                console.log('          FINAL RESULT           ');
                console.log('=================================');
                console.log(`Total Marks:    ${totalMaxMarks}`);
                console.log(`Obtained Marks: ${totalObtainedMarks}`);
                console.log(`Percentage:     ${percentage.toFixed(2)}%`);
                console.log(`Grade:          ${grade}`);
                console.log('=================================\n');
                rl.close();
                return;
            }

            askForNumber(
                `\nSubject ${current} ke Maximum Marks: `,
                (value) => value > 0,
                'Maximum marks zero se zyada hone chahiye.',
                (maxMarks) => {
                    askForNumber(
                        `Subject ${current} ke Obtained Marks: `,
                        (value) => value >= 0 && value <= maxMarks,
                        `Obtained marks 0 se ${maxMarks} ke darmiyan enter karein.`,
                        (obtainedMarks) => {
                            totalMaxMarks += maxMarks;
                            totalObtainedMarks += obtainedMarks;
                            current += 1;
                            askMarks();
                        }
                    );
                }
            );
        }

        askMarks();
    }
);