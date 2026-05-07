export const stringifyRunOutput = (value: unknown) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    "result" in value &&
    typeof value.result === "string"
  ) {
    return value.result;
  }

  if (
    typeof value === "object" &&
    "final_text" in value &&
    typeof value.final_text === "string"
  ) {
    return value.final_text;
  }

  if (
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return JSON.stringify(value, null, 2);
};
