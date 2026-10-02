let value = 32;
let mode = "normal";
let direction = 1;

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

export function setSimulationMode(nextMode) {
  mode = nextMode;
}

export function resetSensor() {
  value = 32;
  direction = 1;
  mode = "normal";
  return value;
}

export function setSensorValue(nextValue) {
  value = clamp(Number(nextValue) || 0, 0, 100);
  return value;
}

export function getNextGasValue() {
  let target;
  let speed;

  if (mode === "leak") {
    target = 78;
    speed = 2.2;
  } else if (mode === "recover") {
    target = 25;
    speed = 1.8;
  } else {
    target = 32 + Math.sin(Date.now() / 7000) * 5;
    speed = 0.9;
  }

  const difference = target - value;

  if (Math.abs(difference) > 0.8) {
    value += Math.sign(difference) * Math.min(Math.abs(difference), speed);
  } else if (mode === "normal") {
    value += direction * (Math.random() * 1.4);
    if (value > 38) direction = -1;
    if (value < 27) direction = 1;
  }

  value += (Math.random() - 0.5) * 0.7;
  value = clamp(value, 0, 100);

  return Number(value.toFixed(1));
}