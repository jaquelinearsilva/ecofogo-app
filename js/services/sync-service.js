/**
 * SYNC-SERVICE.JS - Serviço de Sincronização
 * Classe para gerenciar sincronização com ImgBB e Google Sheets
 */

import { CONFIG } from '../config.js';
import { showToast } from '../utils/ui-helpers.js';

/**
 * Classe SyncService
 * Gerencia upload de fotos e sincronização com backend
 */
export class SyncService {
  constructor(dbManager) {
    this.db = dbManager;
  }

  /**
   * Faz upload de uma foto para ImgBB
   * @param {string} base64Photo - Foto em Base64
   * @returns {Promise<string>} URL pública da foto
   */
  async uploadPhotoToImgBB(base64Photo) {
    try {
      // Remove o prefixo data:image/...;base64,
      const base64Data = base64Photo.split(',')[1];

      const formData = new FormData();
      formData.append('image', base64Data);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_API_KEY}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error('Falha no upload da foto');
      }
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      throw error;
    }
  }

  /**
   * Envia um registro para Google Sheets
   * @param {Object} record - Registro com fotos já como URLs
   * @returns {Promise<void>}
   */
  async sendToGoogleSheets(record) {
    try {
      const response = await fetch(CONFIG.APPSCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(record),
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar para Google Sheets');
      }
    } catch (error) {
      console.error('Erro ao enviar para Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Sincroniza um registro individual
   * @param {Object} record - Registro a sincronizar
   * @returns {Promise<boolean>} Sucesso da sincronização
   */
  async syncRecord(record) {
    try {
      // Faz upload das fotos
      const photoUrls = ['', '', '', '', '', '', '', ''];

      for (let i = 0; i < record.fotos.length && i < CONFIG.MAX_PHOTOS; i++) {
        try {
          photoUrls[i] = await this.uploadPhotoToImgBB(record.fotos[i]);
        } catch (error) {
          console.warn(`Erro ao fazer upload da foto ${i + 1}:`, error);
        }
      }

      // Monta payload para envio
      const payload = {
        id: record.id,
        nome: record.nome,
        ponto: record.ponto,
        data_hora: record.data_hora,
        gps: record.gps,
        tipo: record.tipo,
        especie: record.especie,
        descricao: record.descricao,
        foto1: photoUrls[0] || '',
        foto2: photoUrls[1] || '',
        foto3: photoUrls[2] || '',
        foto4: photoUrls[3] || '',
        foto5: photoUrls[4] || '',
        foto6: photoUrls[5] || '',
        foto7: photoUrls[6] || '',
        foto8: photoUrls[7] || '',
      };

      // Envia para Google Sheets
      await this.sendToGoogleSheets(payload);

      // Deleta do banco local após sucesso
      await this.db.delete(record.id);

      return true;
    } catch (error) {
      console.error('Erro ao sincronizar registro:', record.id, error);
      return false;
    }
  }

  /**
   * Sincroniza todos os registros pendentes
   * @returns {Promise<Object>} {sucesso: número, total: número}
   */
  async syncAllPending() {
    try {
      const records = await this.db.getAllPending();

      if (records.length === 0) {
        showToast('Nenhum registro pendente.');
        return { success: 0, total: 0 };
      }

      let successCount = 0;

      for (const record of records) {
        const synced = await this.syncRecord(record);
        if (synced) {
          successCount++;
        }
      }

      return { success: successCount, total: records.length };
    } catch (error) {
      console.error('Erro na sincronização em lote:', error);
      throw error;
    }
  }
}
