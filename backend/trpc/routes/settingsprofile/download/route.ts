import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const downloadSettingsProfileProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Downloading settings profiles for site:', input.siteId);
    
    try {
      const API_BASE_URL = 'https://app.positron-portal.com/api/v1';
      const url = `${API_BASE_URL}/sites/${encodeURIComponent(input.siteId)}/data/settings-profiles`;
      
      console.log('[tRPC] Fetching from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('[tRPC] No profiles found on server');
          return {
            success: true,
            profiles: [],
          };
        }
        const text = await response.text();
        console.error('[tRPC] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const result = await response.json();
      console.log('[tRPC] Downloaded profiles count:', result.profiles?.length || 0);
      
      return {
        success: true,
        profiles: result.profiles || [],
      };
    } catch (error: any) {
      console.error('[tRPC] Error downloading profiles from server:', error);
      
      return {
        success: false,
        profiles: [],
        error: error.message,
      };
    }
  });

export default downloadSettingsProfileProcedure;
