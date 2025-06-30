import { AIContact } from '../types/types';

/**
 * Shared domain availability checker to eliminate code duplication
 */
export class DomainChecker {
  /**
   * Check domain availability using RDAP
   */
  static async checkDomainAvailability(
    baseDomain: string, 
    customVariations?: string[], 
    contact?: AIContact
  ): Promise<any> {
    try {
      let variations: string[] = customVariations || [];
      
      if (variations.length === 0) {
        const domainIntegration = contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool' && integration.config.enabled
        );
        
        if (domainIntegration?.config.settings.variations) {
          variations = domainIntegration.config.settings.variations.split('\n').filter((v: string) => v.trim());
        } else {
          variations = [
            '{domain}.com',
            '{domain}.net', 
            '{domain}.org',
            'try{domain}.com',
            '{domain}app.com'
          ];
        }
      }

      const maxConcurrent = parseInt(
        contact?.integrations?.find(
          integration => integration.integrationId === 'domain-checker-tool'
        )?.config.settings.maxConcurrent || '5'
      );

      const domainsToCheck = variations.map(variation => 
        variation.replace('{domain}', baseDomain)
      );

      console.log(`🔍 Checking ${domainsToCheck.length} domain variations for "${baseDomain}"`);

      const results = [];
      for (let i = 0; i < domainsToCheck.length; i += maxConcurrent) {
        const batch = domainsToCheck.slice(i, i + maxConcurrent);
        const batchPromises = batch.map(async (domain) => {
          try {
            const response = await fetch(`https://rdap.org/domain/${domain}`, {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });

            const isAvailable = response.status === 404;
            const status = isAvailable ? 'available' : 'taken';
            const method = 'rdap.org';
            
            console.log(`${isAvailable ? '✅' : '❌'} ${domain}: ${status} (via ${method})`);
            
            return {
              domain,
              available: isAvailable,
              status,
              statusCode: response.status,
              method,
              checked: true,
              note: domain.endsWith('.io') && method.includes('rdap.org') ? 'Note: .io domain availability may be uncertain with RDAP' : undefined
            };
          } catch (error) {
            console.error(`❌ Error checking ${domain}:`, error);
            return {
              domain,
              available: false,
              status: 'error',
              error: (error as Error).message,
              checked: false
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to be respectful to the RDAP service
        if (i + maxConcurrent < domainsToCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const availableDomains = results.filter(r => r.available);
      const takenDomains = results.filter(r => !r.available && r.checked);
      const errorDomains = results.filter(r => !r.checked);

      return {
        baseDomain,
        totalChecked: domainsToCheck.length,
        summary: {
          available: availableDomains.length,
          taken: takenDomains.length,
          errors: errorDomains.length
        },
        results: {
          available: availableDomains,
          taken: takenDomains,
          errors: errorDomains
        },
        allResults: results
      };

    } catch (error) {
      console.error('❌ Domain availability check failed:', error);
      throw new Error(`Domain check failed: ${(error as Error).message}`);
    }
  }
} 