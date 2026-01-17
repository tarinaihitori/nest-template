import { Injectable, HttpStatus } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { BusinessException } from '../common/exceptions/business.exception';
import { ErrorCodes } from '../common/constants/error-codes.constant';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.usersRepository.create(createUserDto);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne(id);
    if (!user) {
      throw new BusinessException(
        ErrorCodes.USER_NOT_FOUND,
        `User with ID ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findOne(id);
    return this.usersRepository.update(id, updateUserDto);
  }

  async remove(id: number): Promise<User> {
    await this.findOne(id);
    return this.usersRepository.remove(id);
  }
}
