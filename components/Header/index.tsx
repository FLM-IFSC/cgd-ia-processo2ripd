import React from 'react';

interface HeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  onReset: () => void;
}

/**
 * A reusable header component for the application.
 * Displays the sez.iO logo, title, and a theme toggle button.
 */
export const Header: React.FC<HeaderProps> = ({ theme, toggleTheme, onReset }) => {
  return (
    <header className="bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-md w-full">
      <div className="w-full px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
         <img 
            alt="sez.iO - Agente IA Logo" 
            src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDA5YTQ0IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMmExMCAxMCAwIDEgMCAxMCAxMCIgLz48cGF0aCBkPSJNMTIgMkwxMiA4IiAvPjxwYXRoIGQ9Ik0xMiAxNkwxMiAyMiIgLz48cGF0aCBkPSJNMTcgNUwxNSA3IiAvPjxwYXRoIGQ9Ik05IDdMNyA1IiAvPjxwYXRoIGQ9Ik0xNyAxOUwxNSAxNyIgLz48cGF0aCBkPSJNOSAxN0w3IDE5IiAvPjxwYXRoIGQ9Ik0yMiAxMkwxNiAxMiIgLz48cGF0aCBkPSJNODEyTDIgMTIiIC8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMyIgZmlsbD0iIzAwOWE0NCIgLz48L3N2Zz4="
            className="h-12 w-auto"
          />
          <div>
            <p className="text-xs font-semibold text-ifsc-green tracking-wider uppercase">IFSC - DTIC - CGD</p>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface-light dark:text-on-surface-dark -mt-1">sez.iO - Agente IA</h1>
            <p className="text-sm md:text-md text-on-surface-secondary-light dark:text-on-surface-secondary-dark -mt-1">Assistente de Modelagem de Processos e Relatórios LGPD</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={onReset}
            className="bg-ifsc-green text-white font-bold py-2 px-4 rounded-lg hover:bg-ifsc-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark focus:ring-ifsc-green transition-colors flex items-center justify-center text-sm"
            title="Limpar campos e resultados para iniciar uma nova análise"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Novo Processo
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:bg-black/5 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark focus:ring-ifsc-green"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};