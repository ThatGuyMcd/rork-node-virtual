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
      const API_BASE_URL = 'https://app.positron-portal.com';
      const listUrl = `${API_BASE_URL}/webviewfiles?SITEID=${encodeURIComponent(input.siteId)}&DIRECTORY=${encodeURIComponent('DATA/settings-profiles')}`;
      
      console.log('[tRPC] Fetching file list from:', listUrl);
      
      const listResponse = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!listResponse.ok) {
        if (listResponse.status === 404) {
          console.log('[tRPC] No profiles folder found on server');
          return {
            success: true,
            profiles: [],
          };
        }
        const text = await listResponse.text();
        console.error('[tRPC] Server error response:', listResponse.status, text);
        throw new Error(`Server returned ${listResponse.status}: ${text}`);
      }
      
      const fileList = await listResponse.json();
      console.log('[tRPC] Raw API response:', JSON.stringify(fileList, null, 2));
      console.log('[tRPC] Response type:', typeof fileList);
      console.log('[tRPC] Response keys:', Object.keys(fileList || {}));
      
      let files: string[] = [];
      if (Array.isArray(fileList)) {
        files = fileList;
        console.log('[tRPC] Response is array, length:', files.length);
      } else if (fileList.files && Array.isArray(fileList.files)) {
        files = fileList.files;
        console.log('[tRPC] Response has .files array, length:', files.length);
      } else if (fileList.FILES && Array.isArray(fileList.FILES)) {
        files = fileList.FILES;
        console.log('[tRPC] Response has .FILES array, length:', files.length);
      } else {
        console.log('[tRPC] Could not find file array in response');
      }
      
      if (files.length === 0) {
        console.log('[tRPC] No profile files found');
        return {
          success: true,
          profiles: [],
        };
      }
      
      console.log('[tRPC] Files to download:', files);
      
      const profiles = [];
      for (const fileName of files) {
        if (!fileName.endsWith('.json')) continue;
        
        const fileUrl = `${API_BASE_URL}/webviewfiles?SITEID=${encodeURIComponent(input.siteId)}&FILE=${encodeURIComponent('DATA/settings-profiles/' + fileName)}`;
        console.log('[tRPC] Downloading profile:', fileUrl);
        
        try {
          const fileResponse = await fetch(fileUrl);
          if (fileResponse.ok) {
            const profileData = await fileResponse.json();
            profiles.push(profileData);
          }
        } catch (fileError) {
          console.error('[tRPC] Error downloading profile file:', fileName, fileError);
        }
      }
      
      console.log('[tRPC] Downloaded profiles count:', profiles.length);
      
      return {
        success: true,
        profiles,
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
