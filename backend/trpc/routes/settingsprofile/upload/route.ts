import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const uploadSettingsProfileProcedure = publicProcedure
  .input(
    z.object({
      siteId: z.string(),
      profileName: z.string(),
      profileData: z.any(),
      timestamp: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[tRPC] Uploading settings profile:', input.profileName);
    console.log('[tRPC] Site ID:', input.siteId);
    
    try {
      const fileName = `${input.profileName}.json`;
      const folderPath = `${input.siteId}/settings-profiles`;
      
      const uploadData = {
        SITEID: input.siteId,
        DESTINATIONWEBVIEWFOLDER: folderPath,
        FOLDERDATA: ['settings-profiles'],
        FILEDATA: {
          [fileName]: JSON.stringify({
            profileName: input.profileName,
            profileData: input.profileData,
            timestamp: input.timestamp,
          }),
        },
      };
      
      console.log('[tRPC] Posting to: https://app.positron-portal.com/webviewdataupload');
      console.log('[tRPC] Uploading profile to folder:', folderPath);
      
      const response = await fetch('https://app.positron-portal.com/webviewdataupload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(uploadData),
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[tRPC] Server error response:', response.status, text);
        throw new Error(`Server returned ${response.status}: ${text}`);
      }
      
      const result = await response.json().catch(() => ({ success: true }));
      console.log('[tRPC] Server response:', result);
      
      return {
        success: true,
        profileName: input.profileName,
        serverResponse: result,
      };
    } catch (error: any) {
      console.error('[tRPC] Error uploading profile to server:', error);
      
      return {
        success: false,
        profileName: input.profileName,
        error: error.message,
      };
    }
  });

export default uploadSettingsProfileProcedure;
