"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUsername = void 0;
const positiveAdjectives = [
    "Brave",
    "Clever",
    "Happy",
    "Kind",
    "Quick",
    "Witty",
    "Lucky",
    "Joyful",
    "Proud",
    "Bright"
];
const animals = [
    "Lion",
    "Elephant",
    "Eagle",
    "Tiger",
    "Fox",
    "Dolphin",
    "Penguin",
    "Koala",
    "Panda",
    "Giraffe"
];
const generateUsername = (socketId) => {
    const randomAdjective = positiveAdjectives[Math.floor(Math.random() * positiveAdjectives.length)];
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    const shortSocketId = socketId.slice(0, 4);
    return `${randomAdjective} ${randomAnimal} ${shortSocketId.toUpperCase()}`;
};
exports.generateUsername = generateUsername;
