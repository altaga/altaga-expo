import React from "react";
import { clearCache, writeCache } from "../core/cache";

// App state: everything that is not the session. Read AGENTS.md ("State").
//   setValue           in memory only
//   setPersistentValue in memory and in the cache (restored on next start)
//   resetValue         back to defaults and cache cleared (used on sign-out)
const ContextModule = React.createContext();

const DEFAULT_VALUE = {
  hydrated: false,
  // Add your own defaults here.
};

class ContextProvider extends React.Component {
  state = { value: DEFAULT_VALUE };

  setValue = (value, then = () => {}) => {
    this.setState((previous) => ({ value: { ...previous.value, ...value } }), then);
  };

  setValueAsync = (value) => new Promise((resolve) => this.setValue(value, resolve));

  setPersistentValue = async (value) => {
    this.setValue(value);
    await writeCache(value);
  };

  resetValue = async () => {
    await clearCache().catch(() => {});
    this.setState({ value: { ...DEFAULT_VALUE, hydrated: true } });
  };

  render() {
    const { value } = this.state;
    const { setValue, setValueAsync, setPersistentValue, resetValue } = this;
    return (
      <ContextModule.Provider value={{ value, setValue, setValueAsync, setPersistentValue, resetValue }}>
        {this.props.children}
      </ContextModule.Provider>
    );
  }
}

export { ContextProvider };
export const ContextConsumer = ContextModule.Consumer;
export default ContextModule;
