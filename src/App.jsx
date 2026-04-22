import { useState } from "react";
import LandingPage from "./LandingPage";
import MainApp from "./MainApp";

export default function App() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <LandingPage onStart={() => setStarted(true)} />;
  }

  return <MainApp />;
}
