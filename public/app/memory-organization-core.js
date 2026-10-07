(function (root) {
  const RULE_TYPES = Object.freeze([
    'general_principle','extraction','relevance','classification','structuring',
    'naming','relationship','consolidation','provenance','updating','conflict',
    'deduplication','user_preference'
  ]);
  const RULE_SCOPES = Object.freeze(['global','domain']);
  const RULE_ORIGINS = Object.freeze(['user_manual','ai_learned_candidate','ai_learned_confirmed','system_default']);
  const RULE_STATUSES = Object.freeze(['candidate','active','inactive','rejected','superseded']);
  const DEFAULT_SETTINGS = Object.freeze({ minimum_evidence: 3, minimum_confidence: 70, minimum_diverse_contexts: 2 });

  const stable = value => JSON.stringify(value ?? null);
  function buildDiff(before, after) {
    const diff = {};
    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].sort();
    keys.forEach(key => {
      if (stable(before?.[key]) !== stable(after?.[key])) diff[key] = { before: before?.[key] ?? null, after: after?.[key] ?? null };
    });
    return diff;
  }

  function patternSignature(domain, changedFields) {
    return `${String(domain || 'global').trim().toLowerCase()}::${[...new Set(changedFields || [])].sort().join('|')}`;
  }

  function precedence(rule, domain) {
    const specific = rule.scope === 'domain' && rule.domain === domain ? 10000 : 0;
    const origin = rule.origin === 'user_manual' ? 3000 : rule.origin === 'system_default' ? 2000 : 1000;
    return specific + origin + Number(rule.priority || 0) * 10 + Number(rule.version || 1);
  }

  function resolveApplicableRules(rules, domain, conflicts = []) {
    const applicable = (rules || []).filter(rule =>
      !rule.deleted_at && rule.status === 'active' &&
      (rule.scope === 'global' || (rule.scope === 'domain' && rule.domain === domain))
    ).sort((a, b) => precedence(b, domain) - precedence(a, domain));

    const selected = [];
    const conflictKeys = new Set();
    applicable.forEach(rule => {
      const key = rule.metadata?.conflict_key;
      if (key && conflictKeys.has(key)) return;
      const collides = selected.some(chosen => (conflicts || []).some(conflict =>
        conflict.status === 'open' &&
        ((conflict.rule_a_id === rule.id && conflict.rule_b_id === chosen.id) ||
         (conflict.rule_b_id === rule.id && conflict.rule_a_id === chosen.id))
      ));
      if (collides) return;
      if (key) conflictKeys.add(key);
      selected.push(rule);
    });
    return selected;
  }

  function shouldSuggestCandidate(feedbacks, settings = DEFAULT_SETTINGS, existingRule) {
    if (!feedbacks?.length) return false;
    const threshold = Number(settings.minimum_evidence || DEFAULT_SETTINGS.minimum_evidence);
    const diversityThreshold = Number(settings.minimum_diverse_contexts || DEFAULT_SETTINGS.minimum_diverse_contexts);
    const signature = feedbacks[0].pattern_signature;
    const coherent = feedbacks.filter(item => item.pattern_signature === signature && item.changed_fields?.length);
    if (coherent.length < threshold) return false;
    const contexts = new Set(coherent.map(item => item.context_id || item.source_id || item.id).filter(Boolean));
    if (contexts.size < Math.min(diversityThreshold, threshold)) return false;
    if (!existingRule) return true;
    if (existingRule.status === 'candidate' || existingRule.status === 'active') return false;
    const previousCount = Number(existingRule.metadata?.evidence_count_at_rejection || 0);
    return existingRule.status === 'rejected' && coherent.length >= previousCount + threshold;
  }

  root.MemoryOrganizationCore = Object.freeze({
    RULE_TYPES, RULE_SCOPES, RULE_ORIGINS, RULE_STATUSES, DEFAULT_SETTINGS,
    buildDiff, patternSignature, precedence, resolveApplicableRules, shouldSuggestCandidate
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
