'use client';

import { useState, useCallback, useRef } from 'react';
import { generateId } from '@/lib/id';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

export interface FileWithPreview {
  id: string;
  file: File | FileMetadata;
  preview: string;
}

export interface UseFileUploadOptions {
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
  initialFiles?: FileMetadata[];
  onFilesChange?: (files: FileWithPreview[]) => void;
}

export interface UseFileUploadReturn {
  isDragging: boolean;
  errors: string[];
  removeFile: (id: string) => void;
  clearFiles: () => void;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  openFileDialog: () => void;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement>;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function createFilePreview(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      resolve('');
    }
  });
}

export function useFileUpload({
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  accept = '*',
  multiple = true,
  initialFiles = [],
  onFilesChange,
}: UseFileUploadOptions): UseFileUploadReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<FileWithPreview[]>(() => {
    return initialFiles.map((file) => ({
      id: file.id,
      file: file as unknown as File,
      preview: file.url || '',
    }));
  });
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File "${file.name}" vượt quá kích thước tối đa ${formatBytes(maxSize)}`;
    }
    if (accept !== '*') {
      // Parse accept string to check both MIME types and extensions
      const acceptList = accept.split(',').map(a => a.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileType = file.type.toLowerCase();
      
      const isAccepted = acceptList.some(accepted => {
        // Check MIME type
        if (accepted.includes('/') && fileType === accepted.toLowerCase()) {
          return true;
        }
        // Check extension
        if (accepted.startsWith('.') && fileExtension === accepted.toLowerCase()) {
          return true;
        }
        // Check wildcard patterns like "image/*"
        if (accepted.endsWith('/*')) {
          const baseType = accepted.split('/')[0];
          if (fileType.startsWith(baseType + '/')) {
            return true;
          }
        }
        return false;
      });
      
      if (!isAccepted) {
        return `File "${file.name}" không phải là định dạng được chấp nhận. Chấp nhận: ${acceptList.join(', ')}`;
      }
    }
    return null;
  };

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles: File[] = Array.from(fileList);
      const newErrors: string[] = [];
      const validFiles: File[] = [];

      // Validate files
      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          newErrors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      // Check max files limit
      if (files.length + validFiles.length > maxFiles) {
        newErrors.push(`Chỉ cho phép tối đa ${maxFiles} file`);
        validFiles.splice(maxFiles - files.length);
      }

      setErrors(newErrors);

      // Process valid files
      const processedFiles: FileWithPreview[] = await Promise.all(
        validFiles.map(async (file) => {
          const preview = await createFilePreview(file);
          return {
            id: generateId(),
            file,
            preview,
          };
        })
      );

      const updatedFiles = [...files, ...processedFiles];
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, maxFiles, maxSize, accept, onFilesChange]
  );

  const removeFile = useCallback(
    (id: string) => {
      const updatedFiles = files.filter((f) => f.id !== id);
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, onFilesChange]
  );

  const clearFiles = useCallback(() => {
    setFiles([]);
    onFilesChange?.([]);
  }, [onFilesChange]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        // Reset input so same file can be selected again
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }
    },
    [processFiles]
  );

  const getInputProps = useCallback(() => {
    return {
      ref: inputRef,
      type: 'file',
      accept,
      multiple,
      onChange: handleFileInputChange,
      style: { display: 'none' },
    } as React.InputHTMLAttributes<HTMLInputElement>;
  }, [accept, multiple, handleFileInputChange]);

  return {
    isDragging,
    errors,
    removeFile,
    clearFiles,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFileDialog,
    getInputProps,
  };
}

