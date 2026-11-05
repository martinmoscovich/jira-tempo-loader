/**
 * Turns whatever the user pasted into the "Jira URL" field into the site root, e.g.
 * "https://acme.atlassian.net/browse/ABC-1" or "acme.atlassian.net" or "acme"
 * becomes "https://acme.atlassian.net/". Returns null when it is not a usable URL.
 */
export function normalizeJiraUrl(input: string): string | null {
  let text = input.trim();
  if (!text) return null;
  if (/^[a-z0-9-]+$/i.test(text)) text = `${text}.atlassian.net`;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (!url.hostname.includes('.')) return null;
    return `${url.protocol}//${url.host}/`;
  } catch {
    return null;
  }
}

export interface AccessibleResource {
  id: string;
  url: string;
  name?: string;
}

/**
 * Picks the Jira site the user asked for among the sites the OAuth token can access.
 * Taking the first one would silently connect to the wrong site for people with several.
 */
export function pickSite(resources: AccessibleResource[], jiraUrl: string): AccessibleResource {
  if (resources.length === 0) throw new Error('No accessible Jira sites found');
  const wanted = normalizeJiraUrl(jiraUrl);
  if (!wanted) return resources[0];
  const match = resources.find((resource) => normalizeJiraUrl(resource.url) === wanted);
  if (match) return match;
  const available = resources.map((resource) => resource.url).join(', ');
  throw new Error(
    `This app was not authorized for ${wanted}. Sites available: ${available}. ` +
      'Check the Jira URL, or sign in again and pick that site on the Atlassian consent screen.'
  );
}
