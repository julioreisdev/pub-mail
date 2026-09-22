import PropTypes from 'prop-types';
import { createContext, useMemo } from 'react';

// project imports
import config from 'config';
import { useLocalStorage } from 'hooks/useLocalStorage';

// ==============================|| CONFIG CONTEXT ||============================== //

export const ConfigContext = createContext(undefined);

// ==============================|| CONFIG PROVIDER ||============================== //

export function ConfigProvider({ children }) {
  // chave versionada: ao mudar defaults (fonte Ubuntu, borderRadius) força re-seed
  // pra quem já tinha o config antigo (Roboto) salvo no localStorage.
  const { state, setState, setField, resetState } = useLocalStorage('pubmail-config-v2', config);

  const memoizedValue = useMemo(() => ({ state, setState, setField, resetState }), [state, setField, setState, resetState]);

  return <ConfigContext.Provider value={memoizedValue}>{children}</ConfigContext.Provider>;
}

ConfigProvider.propTypes = { children: PropTypes.node };
