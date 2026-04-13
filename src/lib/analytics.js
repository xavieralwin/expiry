export const trackButtonClick = (buttonName, category = 'Button Click') => {
  // Always log to console in local development for easier testing
  if (import.meta.env && import.meta.env.DEV) {
    console.log(`📊 %c[Analytics Track]`, 'color: #8b5cf6; font-weight: bold;', `Category: "${category}", Button: "${buttonName}"`);
  }

  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'click', {
      event_category: category,
      event_label: buttonName
    });
  } else if (!import.meta.env || !import.meta.env.DEV) {
    console.debug(`[Analytics Track] Fallback - Category: ${category}, Button: ${buttonName}`);
  }
};
