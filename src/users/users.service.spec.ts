import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCodes } from '../common/constants/error-codes.constant';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
      findByEmail: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    service = new UsersService(repository as unknown as UsersRepository);
  });

  describe('create', () => {
    it('ユーザーを作成して返すこと', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        name: 'New User',
      };
      const expectedUser = createMockUser({
        email: createUserDto.email,
        name: createUserDto.name,
      });
      repository.create.mockResolvedValue(expectedUser);

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findAll', () => {
    it('全ユーザーのリストを返すこと', async () => {
      // Arrange
      const expectedUsers = [
        createMockUser({ id: 1, email: 'user1@example.com' }),
        createMockUser({ id: 2, email: 'user2@example.com' }),
      ];
      repository.findAll.mockResolvedValue(expectedUsers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(expectedUsers);
    });

    it('ユーザーが存在しない場合は空配列を返すこと', async () => {
      // Arrange
      repository.findAll.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('指定されたIDのユーザーを返すこと', async () => {
      // Arrange
      const expectedUser = createMockUser({ id: 1 });
      repository.findOne.mockResolvedValue(expectedUser);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result).toEqual(expectedUser);
    });

    it('存在しないIDの場合BusinessExceptionをスローすること', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(BusinessException);
      await expect(service.findOne(999)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });

    it('BusinessExceptionが正しいerrorCodeを持つこと', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      try {
        await service.findOne(999);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.USER_NOT_FOUND,
        );
      }
    });
  });

  describe('update', () => {
    it('ユーザー情報を更新して返すこと', async () => {
      // Arrange
      const existingUser = createMockUser({ id: 1 });
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = createMockUser({
        id: 1,
        name: 'Updated Name',
        updatedAt: new Date('2024-01-02'),
      });
      repository.findOne.mockResolvedValue(existingUser);
      repository.update.mockResolvedValue(updatedUser);

      // Act
      const result = await service.update(1, updateUserDto);

      // Assert
      expect(result).toEqual(updatedUser);
    });

    it('存在しないIDの場合BusinessExceptionをスローすること', async () => {
      // Arrange
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' };
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, updateUserDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.update(999, updateUserDto)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });
  });

  describe('remove', () => {
    it('ユーザーを削除して返すこと', async () => {
      // Arrange
      const existingUser = createMockUser({ id: 1 });
      repository.findOne.mockResolvedValue(existingUser);
      repository.remove.mockResolvedValue(existingUser);

      // Act
      const result = await service.remove(1);

      // Assert
      expect(result).toEqual(existingUser);
    });

    it('存在しないIDの場合BusinessExceptionをスローすること', async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(999)).rejects.toThrow(BusinessException);
      await expect(service.remove(999)).rejects.toThrow(
        'User with ID 999 not found',
      );
    });
  });
});
