(function () {
  try {
    var darkMode = localStorage.getItem('darkMode')
    var systemDarkMode = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches
    if (darkMode === 'true' || (darkMode === null && systemDarkMode)) {
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
    }
  } catch (e) {
    // Ignore errors from localStorage or matchMedia
  }
})()
