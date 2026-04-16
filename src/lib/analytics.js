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

export const trackUserVisit = async () => {
  if (typeof window === 'undefined') return;
  
  const hasVisited = localStorage.getItem('hasVisitedBefore');
  const userType = hasVisited ? 'Repeated User' : 'New User';

  let geoData = {};
  try {
    // Fetch IP and GeoLocation details
    const response = await fetch('https://ipapi.co/json/');
    if (response.ok) {
      geoData = await response.json();
    }
  } catch (error) {
    console.warn('Unable to fetch IP/Geo location for analytics', error);
  }

  if (import.meta.env && import.meta.env.DEV) {
    console.log(`📊 %c[Analytics Track]`, 'color: #8b5cf6; font-weight: bold;', `Visit Type: "${userType}"`, geoData);
  }

  const visitData = {
    event_category: 'Engagement',
    event_label: userType,
    user_type: userType,
    ip_address: geoData.ip || 'Unknown',
    country: geoData.country_name || 'Unknown',
    city: geoData.city || 'Unknown',
    region: geoData.region || 'Unknown'
  };

  if (window.gtag) {
    window.gtag('event', 'user_visit', visitData);

    if (hasVisited) {
      window.gtag('event', 'repeated_user_detected', {
        ...visitData,
        event_category: 'Audience',
        event_label: 'Repeated User'
      });
    }
  }

  if (!hasVisited) {
    localStorage.setItem('hasVisitedBefore', 'true');
  }
};
