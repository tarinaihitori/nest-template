import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let prisma: {
    user: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 'v1StGXR8_Z5jdHi6B',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = {
      user: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    repository = new UsersRepository(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('ユーザーを作成すること', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        name: 'New User',
      };
      const expectedUser = createMockUser({
        email: createUserDto.email,
        name: createUserDto.name,
      });
      prisma.user.create.mockResolvedValue(expectedUser);

      // Act
      const result = await repository.create(createUserDto);

      // Assert
      expect(result).toEqual(expectedUser);
    });
  });

  describe('findAll', () => {
    it('全ユーザーを取得すること', async () => {
      // Arrange
      const expectedUsers = [
        createMockUser({ id: 'abc123456789012345', email: 'user1@example.com' }),
        createMockUser({ id: 'def123456789012345', email: 'user2@example.com' }),
      ];
      prisma.user.findMany.mockResolvedValue(expectedUsers);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual(expectedUsers);
    });

    it('ユーザーが存在しない場合は空配列を返すこと', async () => {
      // Arrange
      prisma.user.findMany.mockResolvedValue([]);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('指定IDのユーザーを取得すること', async () => {
      // Arrange
      const expectedUser = createMockUser({ id: 'v1StGXR8_Z5jdHi6B' });
      prisma.user.findUnique.mockResolvedValue(expectedUser);

      // Act
      const result = await repository.findOne('v1StGXR8_Z5jdHi6B');

      // Assert
      expect(result).toEqual(expectedUser);
    });

    it('存在しないIDの場合nullを返すこと', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findOne('nonexistent1234567');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('指定emailのユーザーを取得すること', async () => {
      // Arrange
      const expectedUser = createMockUser({ email: 'test@example.com' });
      prisma.user.findUnique.mockResolvedValue(expectedUser);

      // Act
      const result = await repository.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(expectedUser);
    });

    it('存在しないemailの場合nullを返すこと', async () => {
      // Arrange
      prisma.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await repository.findByEmail('notfound@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('ユーザー情報を更新すること', async () => {
      // Arrange
      const updateUserDto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = createMockUser({
        id: 'v1StGXR8_Z5jdHi6B',
        name: 'Updated Name',
        updatedAt: new Date('2024-01-02'),
      });
      prisma.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await repository.update('v1StGXR8_Z5jdHi6B', updateUserDto);

      // Assert
      expect(result).toEqual(updatedUser);
    });
  });

  describe('remove', () => {
    it('ユーザーを削除すること', async () => {
      // Arrange
      const deletedUser = createMockUser({ id: 'v1StGXR8_Z5jdHi6B' });
      prisma.user.delete.mockResolvedValue(deletedUser);

      // Act
      const result = await repository.remove('v1StGXR8_Z5jdHi6B');

      // Assert
      expect(result).toEqual(deletedUser);
    });
  });
});
