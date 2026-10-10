export const notifyUser = ({ title, message, tone = "info" }) => {
  if (typeof window === "undefined") return;

  const detail = {
    id: Date.now() + Math.random(),
    title,
    message,
    tone,
  };

  window.dispatchEvent(new CustomEvent("supplylink:notify", { detail }));
};
